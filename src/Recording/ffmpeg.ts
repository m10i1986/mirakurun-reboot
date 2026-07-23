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
import { execFile } from "node:child_process";
import * as log from "../Mirakurun/log";
import { getRecordingConfig } from "./config";

const PROBE_TIMEOUT_MS = 1000 * 30;

/** mpegts.js (MSE) では再生できず、再生時にトランスコードが必要となる映像コーデック */
const TRANSCODE_REQUIRED_CODECS = new Set(["mpeg2video", "mpeg1video", "mpeg4", "vc1"]);

/**
 * ffprobe の実行パスを返す。
 * 明示設定がなければ ffmpegPath の末尾 `ffmpeg` を `ffprobe` に置換して導出する。
 */
export function getFfprobePath(): string {
    if (process.env.FFPROBE_PATH) {
        return process.env.FFPROBE_PATH;
    }
    const ffmpegPath = getRecordingConfig().ffmpegPath;
    return ffmpegPath.replace(/ffmpeg(\.exe)?$/i, (_match, ext: string | undefined) => `ffprobe${ext ?? ""}`);
}

/** 先頭映像ストリームのコーデック名を返す (取得できなければ null) */
export function probeVideoCodec(inputPath: string): Promise<string | null> {
    const args = [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=nokey=1:noprint_wrappers=1",
        inputPath,
    ];

    return new Promise<string | null>((resolve) => {
        execFile(getFfprobePath(), args, { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 64 }, (err, stdout) => {
            if (err) {
                log.warn("failed to probe video codec of `%s` (%s)", inputPath, (err as Error).message);
                resolve(null);
                return;
            }
            resolve(stdout.trim() || null);
        });
    });
}

/** 指定コーデックがブラウザ再生のためにトランスコードを要するかどうかを返す */
export function isTranscodeRequiredCodec(codec: string | null): boolean {
    return codec !== null && TRANSCODE_REQUIRED_CODECS.has(codec.toLowerCase());
}

/**
 * コマンドテンプレートを引数配列に変換する。
 * `%FFMPEG%` はトークン内置換、`<input>` などのプレースホルダはトークン単位で
 * 置換するため、空白を含むファイルパスも安全に渡せる。
 */
export function buildCommandArgs(template: string, replacements: Record<string, string>): string[] {
    const config = getRecordingConfig();

    return template
        .split(/\s+/)
        .filter((token) => token !== "")
        .map((token) => {
            token = token.replace("%FFMPEG%", config.ffmpegPath);
            if (token in replacements) {
                return replacements[token];
            }
            return token;
        });
}
