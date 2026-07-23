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
    {
        in: "query",
        name: "encoder",
        type: "string",
        required: true,
    },
    {
        in: "query",
        name: "removeOriginal",
        type: "boolean",
    },
];

export const post: Operation = (req, res) => {
    const id = req.params.id as any as number;
    const encoderName = String(req.query.encoder ?? "");
    const removeOriginalRaw = String(req.query.removeOriginal ?? "");
    const removeOriginal = removeOriginalRaw === "true" || removeOriginalRaw === "1";

    try {
        const item = recording.encode.add(id, encoderName, removeOriginal);

        res.status(202);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(item));
    } catch (err) {
        const message = (err as Error).message;
        if (/is not found/.test(message)) {
            api.responseError(res, 404, message);
        } else {
            api.responseError(res, 409, message);
        }
    }
};

post.apiDoc = {
    tags: ["recorded", "encode"],
    summary: "Start encoding a recorded item",
    operationId: "encodeRecorded",
    responses: {
        202: {
            description: "Accepted",
            schema: {
                $ref: "#/definitions/EncodeItem",
            },
        },
        404: {
            description: "Not Found",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
        409: {
            description: "Conflict",
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
