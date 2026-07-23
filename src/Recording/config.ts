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
import { _ } from "../Mirakurun/_";

export const DEFAULT_RECORDED_FORMAT = "<year><month><day>-<hour><min>_<service>_<name>.m2ts";

/** 再生時トランスコード用コマンド (MPEG-2 等を H.264 の MPEG-TS に変換して stdout へ出力する) */
export const DEFAULT_STREAM_COMMAND =
    "%FFMPEG% -dual_mono_mode main -ss <ss> -i <input> -sn -threads 0" +
    " -c:a aac -ar 48000 -b:a 192k -ac 2" +
    " -c:v libx264 -vf yadif,scale=-2:720 -b:v 3000k -preset veryfast" +
    " -y -f mpegts pipe:1";

export const DEFAULT_ENCODERS: apid.ConfigRecordingEncoder[] = [
    {
        name: "H.264",
        command:
            "%FFMPEG% -dual_mono_mode main -i <input> -sn -threads 0" +
            " -c:a aac -ar 48000 -b:a 192k -ac 2" +
            " -c:v libx264 -vf yadif,scale=-2:1080 -crf 23 -preset veryfast" +
            " -y -f mp4 -movflags +faststart <output>",
        suffix: ".mp4",
    },
];

export type RecordingConfig = Required<apid.ConfigRecording>;

/** server.yml の `recording` セクションと環境変数からデフォルト適用済みの録画設定を得る */
export function getRecordingConfig(): RecordingConfig {
    const config = _.config.server?.recording || {};

    return {
        recordedDirPath: config.recordedDirPath ?? process.env.RECORDED_DIR_PATH ?? "",
        recordedFormat: config.recordedFormat || DEFAULT_RECORDED_FORMAT,
        startMarginMs: typeof config.startMarginMs === "number" ? config.startMarginMs : 1000 * 15,
        endMarginMs: typeof config.endMarginMs === "number" ? config.endMarginMs : 1000 * 15,
        priority: typeof config.priority === "number" ? config.priority : 2,
        ffmpegPath: config.ffmpegPath || process.env.FFMPEG_PATH || "ffmpeg",
        thumbnailPositionSec: typeof config.thumbnailPositionSec === "number" ? config.thumbnailPositionSec : 5,
        streamCommand: config.streamCommand || DEFAULT_STREAM_COMMAND,
        maxEncode: typeof config.maxEncode === "number" && config.maxEncode >= 1 ? config.maxEncode : 1,
        encoders: Array.isArray(config.encoders) && config.encoders.length > 0 ? config.encoders : DEFAULT_ENCODERS,
    };
}
