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
import type * as apid from "../../../api";
import recording from "../../Recording/_";
import * as api from "../api";

export const get: Operation = (_req, res) => {
    const reserves: apid.Reserve[] = recording.reserve?.items ?? [];
    api.responseJSON(res, reserves);
};

get.apiDoc = {
    tags: ["reserves"],
    operationId: "getReserves",
    responses: {
        200: {
            description: "OK",
            schema: {
                type: "array",
                items: {
                    $ref: "#/definitions/Reserve",
                },
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

export const post: Operation = (req, res) => {
    const programId = req.body?.programId as apid.ProgramId;
    const priority = req.body?.priority as number | undefined;

    if (typeof programId !== "number") {
        api.responseError(res, 400, "programId is required");
        return;
    }

    try {
        const reserve = recording.reserve.createManual(programId, priority);
        res.status(201);
        api.responseJSON(res, reserve);
    } catch (err) {
        api.responseError(res, 409, (err as Error).message);
    }
};

post.apiDoc = {
    tags: ["reserves"],
    summary: "Create a manual reservation",
    operationId: "createReserve",
    parameters: [
        {
            in: "body",
            name: "body",
            required: true,
            schema: {
                type: "object",
                required: ["programId"],
                properties: {
                    programId: {
                        $ref: "#/definitions/ProgramId",
                    },
                    priority: {
                        type: "integer",
                    },
                },
            },
        },
    ],
    responses: {
        201: {
            description: "Created",
            schema: {
                $ref: "#/definitions/Reserve",
            },
        },
        400: {
            description: "Bad Request",
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
