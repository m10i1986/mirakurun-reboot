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
import recording from "../../../Recording/_";
import * as api from "../../api";

export const parameters = [
    {
        in: "path",
        name: "id",
        type: "integer",
        required: true,
    },
];

export const del: Operation = (req, res) => {
    const id = req.params.id as any as number;

    if (recording.encode?.get(id) == null) {
        api.responseError(res, 404);
        return;
    }

    if (recording.encode.cancel(id) === false) {
        api.responseError(res, 409, "encode is not cancelable");
        return;
    }

    res.status(204);
    res.end();
};

del.apiDoc = {
    tags: ["encode"],
    summary: "Cancel an encode job",
    operationId: "cancelEncode",
    responses: {
        204: {
            description: "Canceled",
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
