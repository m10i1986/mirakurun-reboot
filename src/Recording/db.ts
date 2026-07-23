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
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import Queue from "promise-queue";
import * as yieldableJSON from "yieldable-json";
import type * as apid from "../../api";
import * as log from "../Mirakurun/log";

const parseAsync = promisify(yieldableJSON.parseAsync);
const stringifyAsync = promisify(yieldableJSON.stringifyAsync);

function getEnvPath(name: string): string {
    const path = process.env[name];
    if (!path) {
        throw new Error(`env \`${name}\` is not set`);
    }
    return path;
}

export async function loadReserves(): Promise<apid.Reserve[]> {
    return load(getEnvPath("RESERVES_DB_PATH"));
}

export async function saveReserves(data: apid.Reserve[]): Promise<void> {
    return save(getEnvPath("RESERVES_DB_PATH"), data);
}

export async function loadRecorded(): Promise<apid.Recorded[]> {
    return load(getEnvPath("RECORDED_DB_PATH"));
}

export async function saveRecorded(data: apid.Recorded[]): Promise<void> {
    return save(getEnvPath("RECORDED_DB_PATH"), data);
}

// use queue because async fs ops is not thread safe
const dbIOQueue = new Queue(1, Infinity);

async function load(path: string): Promise<any[]> {
    log.info("load db `%s`", path);

    return dbIOQueue.add(async () => {
        if (existsSync(path) === false) {
            log.info("db `%s` is not exists", path);
            return [];
        }

        const json = await readFile(path, "utf8");
        try {
            return await parseAsync(json);
        } catch (e) {
            const err = e as Error;
            log.error("db `%s` is broken (%s: %s)", path, err.name, err.message);
            return [];
        }
    });
}

async function save(path: string, data: any[]): Promise<void> {
    log.info("save db `%s`", path);

    return dbIOQueue.add(async () => {
        const dirPath = dirname(path);
        if (existsSync(dirPath) === false) {
            await mkdir(dirPath, { recursive: true });
        }
        await writeFile(path, await stringifyAsync(data));
    });
}
