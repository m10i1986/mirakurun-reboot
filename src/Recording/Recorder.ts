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
import { createWriteStream, existsSync, type WriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type * as apid from "../../api";
import mirakurun from "../Mirakurun/_";
import Event from "../Mirakurun/Event";
import * as log from "../Mirakurun/log";
import type TSFilter from "../Mirakurun/TSFilter";
import _ from "./_";
import { getRecordingConfig } from "./config";
import { buildRecordedFilename } from "./util";

// setTimeout の上限 (約 24.8 日)
const TIMER_MAX_MS = 2147483647;
const RETRY_INTERVAL_MS = 1000 * 30;
// EIT で番組終了を検出できなかった場合の保険
const HARD_STOP_EXTRA_MS = 1000 * 60;

interface RecordingContext {
    recordedId: apid.RecordedId;
    tsFilter: TSFilter;
    writeStream: WriteStream;
    stopTimerId: NodeJS.Timeout;
    isCanceled: boolean;
}

export class Recorder {
    private _timerMap = new Map<number, NodeJS.Timeout>();
    private _recordingMap = new Map<number, RecordingContext>();
    private _startingSet = new Set<number>();

    constructor() {
        Event.onEvent((message) => {
            if (message.resource !== "reserve") {
                return;
            }
            if (message.type === "create" || message.type === "update") {
                this.schedule((message.data as apid.Reserve).id);
            } else if (message.type === "remove") {
                this.unschedule((message.data as { id: apid.ReserveId }).id);
            }
        });
    }

    get recordingReserveIds(): apid.ReserveId[] {
        return Array.from(this._recordingMap.keys());
    }

    scheduleAll(): void {
        for (const reserve of _.reserve.itemMap.values()) {
            this.schedule(reserve.id);
        }
    }

    schedule(reserveId: apid.ReserveId): void {
        this._clearTimer(reserveId);

        // 録画中・開始処理中はタイマー再設定しない (停止は stop() で行う)
        if (this._recordingMap.has(reserveId) || this._startingSet.has(reserveId)) {
            return;
        }

        const reserve = _.reserve.get(reserveId);
        if (reserve === null || reserve.state !== "reserved" || reserve.isEnabled === false) {
            return;
        }

        const config = getRecordingConfig();
        const now = Date.now();
        const startTime = reserve.program.startAt - config.startMarginMs;
        const endTime = reserve.program.startAt + reserve.program.duration;

        if (endTime + config.endMarginMs < now) {
            log.warn("reserve#%d is missed (program has ended)", reserveId);
            _.reserve.update(reserveId, { state: "failed" });
            return;
        }

        const delay = startTime - now;
        if (delay > TIMER_MAX_MS) {
            // 上限を超える場合は上限まで待って再スケジュール
            this._timerMap.set(
                reserveId,
                setTimeout(() => this.schedule(reserveId), TIMER_MAX_MS),
            );
            return;
        }

        this._timerMap.set(
            reserveId,
            setTimeout(() => this._start(reserveId), Math.max(delay, 0)),
        );

        log.debug("reserve#%d has scheduled (starts in %d sec)", reserveId, Math.max(Math.round(delay / 1000), 0));
    }

    unschedule(reserveId: apid.ReserveId): void {
        this._clearTimer(reserveId);
    }

    /** 録画を停止する (キャンセル扱い) */
    async stop(reserveId: apid.ReserveId): Promise<void> {
        const context = this._recordingMap.get(reserveId);
        if (context === undefined) {
            return;
        }
        context.isCanceled = true;

        await new Promise<void>((resolve) => {
            context.writeStream.once("close", () => resolve());
            context.tsFilter.close();
        });
    }

    private _clearTimer(reserveId: apid.ReserveId): void {
        const timerId = this._timerMap.get(reserveId);
        if (timerId !== undefined) {
            clearTimeout(timerId);
            this._timerMap.delete(reserveId);
        }
    }

    private async _start(reserveId: apid.ReserveId, retryCount = 0): Promise<void> {
        this._clearTimer(reserveId);

        const reserve = _.reserve.get(reserveId);
        if (reserve === null || reserve.isEnabled === false || reserve.state !== "reserved") {
            return;
        }
        if (this._recordingMap.has(reserveId) || this._startingSet.has(reserveId)) {
            return;
        }
        this._startingSet.add(reserveId);
        try {
            await this._startRecording(reserveId, reserve, retryCount);
        } finally {
            this._startingSet.delete(reserveId);
        }
    }

    private async _startRecording(reserveId: apid.ReserveId, reserve: apid.Reserve, retryCount: number): Promise<void> {
        const config = getRecordingConfig();
        const program = reserve.program;
        const endTime = program.startAt + program.duration;

        if (endTime + config.endMarginMs < Date.now()) {
            log.warn("reserve#%d is missed (program has ended)", reserveId);
            _.reserve.update(reserveId, { state: "failed" });
            return;
        }

        const service = mirakurun.service.get(program.networkId, program.serviceId);
        const serviceName = service?.name || "";
        const channelType = service?.channel?.type || "";

        const filename = buildRecordedFilename(config.recordedFormat, program, serviceName, channelType);
        const filePath = join(config.recordedDirPath, filename);

        if (existsSync(config.recordedDirPath) === false) {
            await mkdir(config.recordedDirPath, { recursive: true });
        }

        let recordedId = reserve.recordedId;
        if (typeof recordedId !== "number") {
            recordedId = _.recorded.add({
                programId: program.id,
                reserveId: reserve.id,
                ruleId: reserve.ruleId,
                name: program.name || `event${program.eventId}`,
                serviceName,
                startAt: program.startAt,
                duration: program.duration,
                filePath: filename,
                state: "recording",
            }).id;
        }

        const writeStream = createWriteStream(filePath, { flags: "a" });

        let tsFilter: TSFilter;
        try {
            tsFilter = await mirakurun.tuner.initProgramStream(
                program,
                {
                    id: `Recording:Recorder:reserve#${reserveId}`,
                    priority: reserve.priority,
                    agent: "Mirakurun Recording",
                    disableDecoder: false,
                },
                writeStream,
            );
        } catch (err) {
            writeStream.end();
            log.error("reserve#%d failed to start recording (%s)", reserveId, (err as Error).message);

            // 番組時間内であればリトライする
            if (endTime + config.endMarginMs > Date.now() + RETRY_INTERVAL_MS && retryCount < 20) {
                this._timerMap.set(
                    reserveId,
                    setTimeout(() => this._start(reserveId, retryCount + 1), RETRY_INTERVAL_MS),
                );
                return;
            }

            _.reserve.update(reserveId, { state: "failed" });
            _.recorded.update(recordedId, { state: "failed" });
            return;
        }

        // 番組終了を EIT で検出できない場合の強制停止
        const stopTimerId = setTimeout(
            () => {
                log.warn("reserve#%d recording has reached hard stop time", reserveId);
                tsFilter.close();
            },
            Math.min(endTime + config.endMarginMs + HARD_STOP_EXTRA_MS - Date.now(), TIMER_MAX_MS),
        );

        const context: RecordingContext = {
            recordedId,
            tsFilter,
            writeStream,
            stopTimerId,
            isCanceled: false,
        };
        this._recordingMap.set(reserveId, context);

        _.reserve.update(reserveId, { state: "recording", recordedId });
        log.info("reserve#%d recording has started (%s)", reserveId, filePath);

        writeStream.once("close", () => {
            this._finalize(reserveId, context, filePath);
        });
    }

    private async _finalize(reserveId: apid.ReserveId, context: RecordingContext, filePath: string): Promise<void> {
        clearTimeout(context.stopTimerId);
        this._recordingMap.delete(reserveId);

        let fileSize = 0;
        try {
            fileSize = (await stat(filePath)).size;
        } catch (err) {
            log.error("reserve#%d failed to stat `%s` (%s)", reserveId, filePath, (err as Error).message);
        }

        const hasFailed = fileSize === 0;
        const reserveState: apid.ReserveState = context.isCanceled ? "canceled" : hasFailed ? "failed" : "finished";
        const recordedState: apid.RecordedState = hasFailed ? "failed" : "finished";

        _.reserve.update(reserveId, { state: reserveState });
        _.recorded.update(context.recordedId, { state: recordedState, fileSize });

        log.info("reserve#%d recording has finished (state=%s, size=%d bytes)", reserveId, recordedState, fileSize);
    }
}

export default Recorder;
