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
import type * as apid from "../../../../api";
import * as api from "../../api";
import * as config from "../../config";

export const get: Operation = async (_req, res) => {
    res.status(200);
    api.responseJSON(res, (await config.loadGuide()) as apid.ConfigGuide);
};

get.apiDoc = {
    tags: ["config"],
    operationId: "getGuideConfig",
    responses: {
        200: {
            description: "OK",
            schema: {
                $ref: "#/definitions/ConfigGuide",
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

export const put: Operation = async (req, res) => {
    const guide: apid.ConfigGuide = req.body;

    // 不正な値が混入しないよう number のみを残して正規化する
    const hiddenServiceIds = Array.isArray(guide.hiddenServiceIds)
        ? guide.hiddenServiceIds.filter((id) => typeof id === "number")
        : [];
    const normalized: apid.ConfigGuide = { hiddenServiceIds };

    await config.saveGuide(normalized);

    res.status(200);
    api.responseJSON(res, normalized);
};

put.apiDoc = {
    tags: ["config"],
    operationId: "updateGuideConfig",
    parameters: [
        {
            in: "body",
            name: "body",
            schema: {
                $ref: "#/definitions/ConfigGuide",
            },
        },
    ],
    responses: {
        200: {
            description: "OK",
            schema: {
                $ref: "#/definitions/ConfigGuide",
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
