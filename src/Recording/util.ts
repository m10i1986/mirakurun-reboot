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
import { replaceCommandTemplate } from "../Mirakurun/common";

/** ファイル名に使用できない文字を全角等へ置換する */
export function sanitizeFilename(name: string): string {
    let sanitized = name
        .replace(/\//g, "／")
        .replace(/\\/g, "＼")
        .replace(/:/g, "：")
        .replace(/\*/g, "＊")
        .replace(/\?/g, "？")
        .replace(/"/g, "”")
        .replace(/</g, "＜")
        .replace(/>/g, "＞")
        .replace(/\|/g, "｜");

    // remove control characters
    sanitized = Array.from(sanitized)
        .filter((char) => (char.codePointAt(0) ?? 0) >= 0x20)
        .join("");

    return sanitized.trim();
}

/**
 * 録画ファイル名を生成する
 * 使用可能な変数: <year> <month> <day> <hour> <min> <sec> <name> <service> <sid> <nid> <eid> <type>
 */
export function buildRecordedFilename(
    format: string,
    program: apid.Program,
    serviceName: string,
    channelType: string,
): string {
    const date = new Date(program.startAt);
    const pad = (n: number) => n.toString(10).padStart(2, "0");

    const filename = replaceCommandTemplate(format, {
        year: date.getFullYear(),
        month: pad(date.getMonth() + 1),
        day: pad(date.getDate()),
        hour: pad(date.getHours()),
        min: pad(date.getMinutes()),
        sec: pad(date.getSeconds()),
        name: sanitizeFilename(program.name || `event${program.eventId}`),
        service: sanitizeFilename(serviceName || `service${program.serviceId}`),
        sid: program.serviceId,
        nid: program.networkId,
        eid: program.eventId,
        type: channelType,
    });

    return sanitizeFilename(filename);
}
