/*
   Copyright 2016 kanreisa

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
import type Channel from "./Channel";
import type Event from "./Event";
import type Job from "./Job";
import type Program from "./Program";
import type Server from "./Server";
import type Service from "./Service";
import type Tuner from "./Tuner";

interface Shared {
    readonly config: {
        server: apid.ConfigServer;
        channels: apid.ConfigChannels;
        tuners: apid.ConfigTuners;
    };
    readonly configIntegrity: {
        channels: string;
    };
    job: Job;
    event: Event;
    tuner: Tuner;
    channel: Channel;
    service: Service;
    program: Program;
    server: Server;
}

// 各プロパティは起動時 (src/server.ts の SETUP フェーズ) に必ず代入される
export const _ = {
    config: {},
    configIntegrity: {
        channels: "",
    },
} as Shared;

export default _;
