/*
   Copyright 2026 MINETA "m10i" Hiroki

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type * as apid from "../../api";
import Event from "../Mirakurun/Event";
import * as log from "../Mirakurun/log";
import _ from "./_";
import { getRecordingConfig } from "./config";
import { buildCommandArgs } from "./ffmpeg";

// 失敗・キャンセルしたジョブをキューに残す時間 (原因確認用)。成功したジョブは即座に削除する
const FAILED_RETAIN_MS = 1000 * 60 * 5;

export class Encode {
    private _itemMap = new Map<number, apid.EncodeItem>();
    private _processMap = new Map<number, ChildProcess>();
    private _canceledSet = new Set<number>();
    private _queue: apid.EncodeId[] = [];
    private _runningCount = 0;
    private _nextId = 1;

    get items(): apid.EncodeItem[] {
        return Array.from(this._itemMap.values()).sort((a, b) => a.id - b.id);
    }

    get(id: number): apid.EncodeItem | null {
        return this._itemMap.get(id) || null;
    }

    /** エンコードジョブをキューに追加する */
    add(recordedId: apid.RecordedId, encoderName: string, removeOriginal: boolean): apid.EncodeItem {
        const recorded = _.recorded.get(recordedId);
        if (recorded === null) {
            throw new Error(`recorded#${recordedId} is not found`);
        }
        if (recorded.state !== "finished") {
            throw new Error(`recorded#${recordedId} is not ready to encode (state=${recorded.state})`);
        }
        // エンコード済み出力 (sourceRecordedId 有り) で、かつ元の MPEG2-TS が削除済みの場合は
        // 再エンコード (再圧縮による劣化) を禁止する
        if (recorded.sourceRecordedId !== undefined && _.recorded.get(recorded.sourceRecordedId) === null) {
            throw new Error(
                `recorded#${recordedId} is an encoded output whose source has been removed; re-encoding is not allowed`,
            );
        }

        const encoder = getRecordingConfig().encoders.find((e) => e.name === encoderName);
        if (encoder === undefined) {
            throw new Error(`encoder \`${encoderName}\` is not found`);
        }

        const item: apid.EncodeItem = {
            id: this._nextId++,
            recordedId,
            encoderName,
            state: "waiting",
            progress: 0,
            removeOriginal: removeOriginal === true,
            createdAt: Date.now(),
        };

        this._itemMap.set(item.id, item);
        this._queue.push(item.id);
        Event.emit("encode", "create", item);
        log.info("encode#%d has queued for recorded#%d (%s)", item.id, recordedId, encoderName);

        this._dequeue();

        return item;
    }

    /** 待機中ならキューから除去、実行中なら ffmpeg を停止する */
    cancel(id: apid.EncodeId): boolean {
        const item = this.get(id);
        if (item === null) {
            return false;
        }

        if (item.state === "waiting") {
            const index = this._queue.indexOf(id);
            if (index !== -1) {
                this._queue.splice(index, 1);
            }
            this._update(item, { state: "canceled", finishedAt: Date.now() });
            this._scheduleRemoval(id);
            log.info("encode#%d has canceled (was waiting)", id);
            return true;
        }

        if (item.state === "encoding") {
            this._canceledSet.add(id);
            this._processMap.get(id)?.kill("SIGKILL");
            return true;
        }

        return false;
    }

    private _dequeue(): void {
        const maxEncode = getRecordingConfig().maxEncode;
        while (this._runningCount < maxEncode && this._queue.length > 0) {
            const id = this._queue.shift();
            if (id === undefined) {
                break;
            }
            const item = this.get(id);
            if (item === null || item.state !== "waiting") {
                continue;
            }
            this._run(item);
        }
    }

    private _run(item: apid.EncodeItem): void {
        const config = getRecordingConfig();

        const recorded = _.recorded.get(item.recordedId);
        if (recorded === null) {
            this._fail(item, "source recorded is not found");
            return;
        }

        const inputPath = _.recorded.getAbsoluteFilePath(recorded);
        if (inputPath === null || existsSync(inputPath) === false) {
            this._fail(item, "source file is not found");
            return;
        }

        const encoder = config.encoders.find((e) => e.name === item.encoderName);
        if (encoder === undefined) {
            this._fail(item, `encoder \`${item.encoderName}\` is not found`);
            return;
        }

        const outputFilename = this._resolveOutputFilename(recorded.filePath, encoder.suffix);
        const outputPath = join(config.recordedDirPath, outputFilename);

        const args = buildCommandArgs(encoder.command, {
            "<input>": inputPath,
            "<output>": outputPath,
        });
        const command = args.shift();
        if (command === undefined) {
            this._fail(item, "invalid encoder command");
            return;
        }

        this._runningCount++;
        this._update(item, { state: "encoding", progress: 0, startedAt: Date.now() });
        log.info("encode#%d has started (recorded#%d -> %s)", item.id, item.recordedId, outputFilename);

        let proc: ChildProcess;
        try {
            proc = spawn(command, args);
        } catch (err) {
            this._runningCount--;
            this._fail(item, (err as Error).message);
            this._dequeue();
            return;
        }
        this._processMap.set(item.id, proc);

        const durationSec = recorded.duration / 1000;
        proc.stderr?.on("data", (chunk) => {
            const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(String(chunk));
            if (match !== null && durationSec > 0) {
                const sec = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
                const progress = Math.min(Math.max(sec / durationSec, 0), 0.999);
                if (progress > item.progress) {
                    this._update(item, { progress });
                }
            }
        });

        proc.on("error", (err) => {
            log.error("encode#%d ffmpeg error (%s)", item.id, (err as Error).message);
        });

        proc.on("close", (code) => {
            this._processMap.delete(item.id);
            this._runningCount--;
            void this._finalize(item, recorded, outputPath, outputFilename, code);
            this._dequeue();
        });
    }

    private async _finalize(
        item: apid.EncodeItem,
        sourceRecorded: apid.Recorded,
        outputPath: string,
        outputFilename: string,
        code: number | null,
    ): Promise<void> {
        if (this._canceledSet.delete(item.id) === true) {
            await this._safeUnlink(outputPath);
            this._update(item, { state: "canceled", finishedAt: Date.now() });
            this._scheduleRemoval(item.id);
            log.info("encode#%d has canceled", item.id);
            return;
        }

        if (code !== 0) {
            await this._safeUnlink(outputPath);
            this._update(item, { state: "failed", error: `ffmpeg exited with code ${code}`, finishedAt: Date.now() });
            this._scheduleRemoval(item.id);
            log.error("encode#%d has failed (code=%s)", item.id, String(code));
            return;
        }

        let fileSize = 0;
        try {
            fileSize = (await stat(outputPath)).size;
        } catch {
            fileSize = 0;
        }
        if (fileSize === 0) {
            await this._safeUnlink(outputPath);
            this._update(item, { state: "failed", error: "output file is empty or missing", finishedAt: Date.now() });
            this._scheduleRemoval(item.id);
            log.error("encode#%d has failed (empty output)", item.id);
            return;
        }

        // 出力を新しい録画済みとして登録する (sourceRecordedId でエンコード元を参照)
        _.recorded.add({
            programId: sourceRecorded.programId,
            reserveId: sourceRecorded.reserveId,
            ruleId: sourceRecorded.ruleId,
            name: sourceRecorded.name,
            serviceName: sourceRecorded.serviceName,
            startAt: sourceRecorded.startAt,
            duration: sourceRecorded.duration,
            filePath: outputFilename,
            sourceRecordedId: sourceRecorded.id,
            fileSize,
            state: "finished",
        });

        if (item.removeOriginal === true) {
            await _.recorded.remove(sourceRecorded.id);
        }

        this._update(item, { state: "finished", progress: 1, finishedAt: Date.now() });
        // 成功したジョブはキューに残さず即座に削除する ("update" 通知の後に "remove" を送る)
        this._scheduleRemoval(item.id, 0);
        log.info("encode#%d has finished (%s, size=%d bytes)", item.id, outputFilename, fileSize);
    }

    private _fail(item: apid.EncodeItem, reason: string): void {
        this._update(item, { state: "failed", error: reason, finishedAt: Date.now() });
        this._scheduleRemoval(item.id);
        log.error("encode#%d has failed (%s)", item.id, reason);
        this._dequeue();
    }

    private _update(item: apid.EncodeItem, props: Partial<apid.EncodeItem>): void {
        Object.assign(item, props);
        Event.emit("encode", "update", item);
    }

    private _scheduleRemoval(id: apid.EncodeId, delayMs: number = FAILED_RETAIN_MS): void {
        setTimeout(() => {
            if (this._itemMap.delete(id) === true) {
                Event.emit("encode", "remove", { id });
            }
        }, delayMs).unref();
    }

    /** 出力ファイル名を決定する (既存ファイルと衝突する場合は連番を付与) */
    private _resolveOutputFilename(sourceRelPath: string, suffix: string): string {
        const dirPath = getRecordingConfig().recordedDirPath;
        const base = basename(sourceRelPath, extname(sourceRelPath));

        let filename = `${base}${suffix}`;
        let counter = 1;
        while (existsSync(join(dirPath, filename)) === true) {
            filename = `${base}-${counter}${suffix}`;
            counter++;
        }
        return filename;
    }

    private async _safeUnlink(filePath: string): Promise<void> {
        try {
            await unlink(filePath);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                log.warn("encode failed to unlink `%s` (%s)", filePath, (err as Error).message);
            }
        }
    }
}

export default Encode;
