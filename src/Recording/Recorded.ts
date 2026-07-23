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
import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type * as apid from "../../api";
import { updateObject } from "../Mirakurun/common";
import Event from "../Mirakurun/Event";
import * as log from "../Mirakurun/log";
import { getRecordingConfig } from "./config";
import * as db from "./db";

export class Recorded {
    private _itemMap = new Map<number, apid.Recorded>();
    private _saveTimerId: NodeJS.Timeout | undefined;
    private _nextId = 1;

    get itemMap(): Map<number, apid.Recorded> {
        return this._itemMap;
    }

    get items(): apid.Recorded[] {
        return Array.from(this._itemMap.values()).sort((a, b) => b.startAt - a.startAt);
    }

    get(id: number): apid.Recorded | null {
        return this._itemMap.get(id) || null;
    }

    /** filePath は recordedDirPath からの相対パス */
    add(props: Omit<apid.Recorded, "id" | "createdAt" | "updatedAt">): apid.Recorded {
        const now = Date.now();
        const item: apid.Recorded = {
            ...props,
            id: this._nextId++,
            createdAt: now,
            updatedAt: now,
        };

        this._itemMap.set(item.id, item);
        this.save();
        Event.emit("recorded", "create", item);

        return item;
    }

    update(id: number, props: Partial<apid.Recorded>): apid.Recorded | null {
        const item = this.get(id);
        if (item === null) {
            return null;
        }

        if (updateObject(item, props) === true) {
            item.updatedAt = Date.now();
            this.save();
            Event.emit("recorded", "update", item);
        }
        return item;
    }

    /** 録画ファイルごと削除する */
    async remove(id: number): Promise<boolean> {
        const item = this.get(id);
        if (item === null) {
            return false;
        }
        if (item.state === "recording") {
            return false;
        }

        const filePath = this.getAbsoluteFilePath(item);
        if (filePath !== null) {
            try {
                await unlink(filePath);
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                    log.error("failed to unlink `%s` (%s)", filePath, (err as Error).message);
                    return false;
                }
            }
        }

        this._itemMap.delete(id);
        this.save();
        Event.emit("recorded", "remove", { id });

        log.info("recorded#%d has removed", id);

        return true;
    }

    /** ディレクトリトラバーサルを防いだ絶対パスを返す */
    getAbsoluteFilePath(item: apid.Recorded): string | null {
        const dirPath = resolve(getRecordingConfig().recordedDirPath);
        const filePath = resolve(join(dirPath, item.filePath));

        if (filePath !== dirPath && filePath.startsWith(dirPath + "/") === false) {
            log.error("recorded#%d has invalid filePath `%s`", item.id, item.filePath);
            return null;
        }
        return filePath;
    }

    async load(): Promise<void> {
        log.debug("loading recorded...");

        const items = await db.loadRecorded();
        for (const item of items) {
            // 録画中のままクラッシュしたものは failed 扱い
            if (item.state === "recording") {
                item.state = "failed";
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

    private _save(): void {
        log.debug("saving recorded...");
        db.saveRecorded(Array.from(this._itemMap.values()));
    }
}

export default Recorded;
