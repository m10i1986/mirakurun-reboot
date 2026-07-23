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
import type * as apid from "../../api";
import mirakurun from "../Mirakurun/_";
import { deepClone, updateObject } from "../Mirakurun/common";
import Event from "../Mirakurun/Event";
import * as log from "../Mirakurun/log";
import _ from "./_";
import { getRecordingConfig } from "./config";
import * as db from "./db";

const RESERVE_GC_EXPIRE = 1000 * 60 * 60 * 24; // 24 hours

export class Reserve {
    private _itemMap = new Map<number, apid.Reserve>();
    private _saveTimerId!: NodeJS.Timeout;
    private _nextId = 1;

    constructor() {
        mirakurun.job.addSchedule({
            key: "Recording.ReserveGC",
            schedule: "50 * * * *",
            job: {
                key: "Recording.ReserveGC",
                name: "Recording Reserve GC",
                fn: async () => this.gc(),
            },
        });

        // 番組情報の更新に追従する (開始時刻・長さの変化を予約へ反映)
        Event.onEvent((message) => {
            if (message.resource !== "program") {
                return;
            }
            if (message.type === "update" || message.type === "create") {
                this._onProgramUpdated(message.data as apid.Program);
            }
        });
    }

    get itemMap(): Map<number, apid.Reserve> {
        return this._itemMap;
    }

    get items(): apid.Reserve[] {
        return Array.from(this._itemMap.values()).sort((a, b) => a.program.startAt - b.program.startAt);
    }

    get(id: number): apid.Reserve | null {
        return this._itemMap.get(id) || null;
    }

    findByProgramId(programId: apid.ProgramId): apid.Reserve | null {
        for (const item of this._itemMap.values()) {
            if (item.programId === programId) {
                return item;
            }
        }
        return null;
    }

    createManual(programId: apid.ProgramId, priority?: number): apid.Reserve {
        const program = mirakurun.program.get(programId);
        if (program === null) {
            throw new Error(`program#${programId} is not found`);
        }

        const existing = this.findByProgramId(program.id);
        if (existing !== null) {
            throw new Error(`program#${program.id} is already reserved (reserve#${existing.id})`);
        }
        if (program.startAt + program.duration < Date.now()) {
            throw new Error(`program#${program.id} is already finished`);
        }

        const now = Date.now();
        const item: apid.Reserve = {
            id: this._nextId++,
            type: "manual",
            programId: program.id,
            program: deepClone(program),
            priority: typeof priority === "number" ? priority : getRecordingConfig().priority,
            isEnabled: true,
            state: "reserved",
            createdAt: now,
            updatedAt: now,
        };

        this._itemMap.set(item.id, item);
        this.save();
        Event.emit("reserve", "create", item);

        log.info("reserve#%d has created for program#%d (%s)", item.id, program.id, program.name);

        return item;
    }

    update(id: number, props: Partial<apid.Reserve>): apid.Reserve | null {
        const item = this.get(id);
        if (item === null) {
            return null;
        }

        if (updateObject(item, props) === true) {
            item.updatedAt = Date.now();
            this.save();
            Event.emit("reserve", "update", item);
        }
        return item;
    }

    /** 録画中なら停止し、予約をキャンセルする */
    async cancel(id: number): Promise<apid.Reserve | null> {
        const item = this.get(id);
        if (item === null) {
            return null;
        }

        if (item.state === "recording") {
            await _.recorder.stop(id);
        }
        if (item.state === "reserved" || item.state === "recording") {
            this.update(id, { state: "canceled" });
        }
        return item;
    }

    remove(id: number): boolean {
        const item = this.get(id);
        if (item === null) {
            return false;
        }
        if (item.state === "recording") {
            return false;
        }

        this._itemMap.delete(id);
        this.save();
        Event.emit("reserve", "remove", { id });
        return true;
    }

    async load(): Promise<void> {
        log.debug("loading reserves...");

        const now = Date.now();
        const items = await db.loadReserves();
        for (const item of items) {
            // 録画中のままクラッシュしたものは failed 扱い
            if (item.state === "recording") {
                item.state = "failed";
            }
            // 終了済みエントリは一定期間で破棄
            if (item.program.startAt + item.program.duration + RESERVE_GC_EXPIRE < now) {
                continue;
            }
            this._itemMap.set(item.id, item);
            if (item.id >= this._nextId) {
                this._nextId = item.id + 1;
            }
        }
    }

    save(): void {
        clearTimeout(this._saveTimerId);
        this._saveTimerId = setTimeout(() => this._save(), 1000);
    }

    /** 終了済み予約の整理 (Job から呼ばれる) */
    gc(): void {
        const now = Date.now();
        let count = 0;

        for (const item of this._itemMap.values()) {
            if (item.state === "recording") {
                continue;
            }
            if (item.program.startAt + item.program.duration + RESERVE_GC_EXPIRE < now) {
                this._itemMap.delete(item.id);
                Event.emit("reserve", "remove", { id: item.id });
                ++count;
            }
        }

        if (count > 0) {
            this.save();
        }
        log.info("Reserve GC has finished and removed %d reserves", count);
    }

    private _onProgramUpdated(program: apid.Program): void {
        const item = this.findByProgramId(program.id);
        if (item === null || item.state !== "reserved") {
            return;
        }
        this.update(item.id, { program: deepClone(program) });
    }

    private _save(): void {
        log.debug("saving reserves...");
        db.saveReserves(Array.from(this._itemMap.values()));
    }
}

export default Reserve;
