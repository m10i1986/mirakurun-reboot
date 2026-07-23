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
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import type { Operation } from "express-openapi";
import recording from "../../../../Recording/_";
import * as api from "../../../api";

export const parameters = [
    {
        in: "path",
        name: "id",
        type: "integer",
        required: true,
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
    if (filePath === null) {
        api.responseError(res, 404, "recorded file is not found");
        return;
    }

    let fileSize: number;
    try {
        fileSize = (await stat(filePath)).size;
    } catch {
        api.responseError(res, 404, "recorded file is not found");
        return;
    }

    const filename = basename(recorded.filePath);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    // Range リクエスト (シーク・レジューム) 対応
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = fileSize - 1;
    let status = 200;

    if (typeof rangeHeader === "string") {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (match === null) {
            res.setHeader("Content-Range", `bytes */${fileSize}`);
            res.status(416).end();
            return;
        }

        start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
        end = match[2] === "" ? fileSize - 1 : Number.parseInt(match[2], 10);
        end = Math.min(end, fileSize - 1);

        if (start > end || start >= fileSize) {
            res.setHeader("Content-Range", `bytes */${fileSize}`);
            res.status(416).end();
            return;
        }

        status = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    }

    res.setHeader("Content-Length", end - start + 1);
    res.status(status);

    if (req.method === "HEAD") {
        res.end();
        return;
    }

    const stream = createReadStream(filePath, { start, end });
    stream.on("error", () => res.destroy());
    req.once("close", () => stream.destroy());
    stream.pipe(res);
};

get.apiDoc = {
    tags: ["recorded"],
    summary: "Download the raw recorded file (supports Range requests)",
    operationId: "getRecordedFile",
    produces: ["video/mp2t"],
    responses: {
        200: {
            description: "OK",
        },
        206: {
            description: "Partial Content",
        },
        404: {
            description: "Not Found",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
        416: {
            description: "Range Not Satisfiable",
        },
        default: {
            description: "Unexpected Error",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
    },
};

export const head: Operation = (...args) => get(...args);

head.apiDoc = {
    ...get.apiDoc,
    operationId: undefined,
};
