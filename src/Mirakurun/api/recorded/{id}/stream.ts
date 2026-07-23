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
import type { Operation } from "express-openapi";
import recording from "../../../../Recording/_";
import { getRecordingConfig } from "../../../../Recording/config";
import { buildCommandArgs, isTranscodeRequiredCodec, probeVideoCodec } from "../../../../Recording/ffmpeg";
import * as api from "../../../api";
import * as log from "../../../log";

/** 映像がブラウザ再生可能な場合のリマックス用コマンド (再エンコードせず MPEG-TS へ詰め替える) */
const REMUX_COMMAND = "%FFMPEG% -ss <ss> -i <input> -c copy -f mpegts pipe:1";

export const parameters = [
    {
        in: "path",
        name: "id",
        type: "integer",
        required: true,
    },
    {
        in: "query",
        name: "ss",
        type: "number",
        minimum: 0,
    },
];

export const get: Operation = async (req, res) => {
    const id = req.params.id as any as number;
    const recorded = recording.recorded?.get(id) ?? null;

    if (recorded === null) {
        api.responseError(res, 404);
        return;
    }

    const filePath = recording.recorded.getAbsoluteFilePath(recorded);
    if (filePath === null || existsSync(filePath) === false) {
        api.responseError(res, 404, "recorded file is not found");
        return;
    }

    const ss = Math.max(Number(req.query.ss) || 0, 0);

    // ブラウザや一般的なプレイヤーで再生しにくいコーデック (MPEG-2 等) の場合のみトランスコードする
    const codec = await probeVideoCodec(filePath);
    const config = getRecordingConfig();
    const template = isTranscodeRequiredCodec(codec) ? config.streamCommand : REMUX_COMMAND;
    const args = buildCommandArgs(template, {
        "<input>": filePath,
        "<ss>": String(ss),
    });
    const command = args.shift();
    if (command === undefined) {
        api.responseError(res, 500, "invalid stream command");
        return;
    }

    let ffmpeg: ChildProcess;
    try {
        ffmpeg = spawn(command, args);
    } catch (err) {
        api.responseStreamErrorHandler(res, err as NodeJS.ErrnoException);
        return;
    }

    let closed = false;
    const cleanup = () => {
        if (closed === true) {
            return;
        }
        closed = true;
        ffmpeg.stdout?.unpipe(res);
        ffmpeg.kill("SIGKILL");
    };

    ffmpeg.on("error", (err) => {
        log.error("recorded#%d stream ffmpeg error (%s)", id, (err as Error).message);
        cleanup();
        if (res.headersSent === false) {
            api.responseError(res, 500, (err as Error).message);
        } else {
            res.destroy();
        }
    });

    // 進捗・エラー診断用に stderr は debug ログへ流す
    ffmpeg.stderr?.on("data", (chunk) => {
        log.debug("recorded#%d stream ffmpeg: %s", id, String(chunk).trim());
    });

    ffmpeg.on("close", () => {
        if (res.writableEnded === false) {
            res.end();
        }
    });

    req.once("close", cleanup);
    res.once("close", cleanup);

    res.socket?.setNoDelay(true);
    res.setHeader("Content-Type", "video/mp2t");
    res.status(200);
    ffmpeg.stdout?.pipe(res);
};

get.apiDoc = {
    tags: ["recorded", "stream"],
    summary: "Stream a recorded item for in-browser playback (transcoded if necessary)",
    operationId: "getRecordedStream",
    produces: ["video/mp2t"],
    responses: {
        200: {
            description: "OK",
        },
        404: {
            description: "Not Found",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
        default: {
            description: "Unexpected Error",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
    },
};

// HEAD はファイルの存在のみ確認し、ffmpeg は起動しない
export const head: Operation = (req, res) => {
    const id = req.params.id as any as number;
    const recorded = recording.recorded?.get(id) ?? null;

    if (recorded === null || recording.recorded.getAbsoluteFilePath(recorded) === null) {
        res.status(404).end();
        return;
    }

    res.setHeader("Content-Type", "video/mp2t");
    res.status(200).end();
};

head.apiDoc = {
    ...get.apiDoc,
    operationId: undefined,
};
