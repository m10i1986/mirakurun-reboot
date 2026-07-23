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
Buffer.poolSize = 0; // disable memory pool

require("dotenv").config();

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

if (process.platform !== "linux") {
    console.warn("running in not linux!");
}

if (process.getuid?.() === 0) {
    try {
        execSync(`renice -n -10 -p ${process.pid}`, { stdio: "pipe" });
    } catch {
        // rootless containers map uid=0 to an unprivileged host user; EPERM is expected
        console.info("renice skipped: insufficient privilege (expected under rootless)");
    }
    try {
        execSync(`ionice -c 1 -n 7 -p ${process.pid}`, { stdio: "pipe" });
    } catch {
        // IOPRIO_CLASS_RT requires CAP_SYS_NICE in the initial user namespace; EPERM is expected under rootless
        console.info("ionice skipped: insufficient privilege (expected under rootless)");
    }
} else {
    console.warn("running in not root!");
}

process.title = "Mirakurun: Server";

process.on("uncaughtException", (err) => {
    ++status.errorCount.uncaughtException;
    console.error(err.stack);
});
process.on("unhandledRejection", (err) => {
    ++status.errorCount.unhandledRejection;
    console.error(err);
});

function setEnv(name: string, value: string) {
    process.env[name] = process.env[name] || value;
}
setEnv("SERVER_CONFIG_PATH", "/usr/local/etc/mirakurun/server.yml");
setEnv("TUNERS_CONFIG_PATH", "/usr/local/etc/mirakurun/tuners.yml");
setEnv("CHANNELS_CONFIG_PATH", "/usr/local/etc/mirakurun/channels.yml");
setEnv("GUIDE_CONFIG_PATH", "/usr/local/etc/mirakurun/guide.yml");
setEnv("SERVICES_DB_PATH", "/usr/local/var/db/mirakurun/services.json");
setEnv("PROGRAMS_DB_PATH", "/usr/local/var/db/mirakurun/programs.json");
setEnv("LOGO_DATA_DIR_PATH", "/usr/local/var/db/mirakurun/logo-data");
setEnv("RESERVES_DB_PATH", "/usr/local/var/db/mirakurun/reserves.json");
setEnv("RECORDED_DB_PATH", "/usr/local/var/db/mirakurun/recorded.json");

import _ from "./Mirakurun/_";
import Channel from "./Mirakurun/Channel";
import * as config from "./Mirakurun/config";
import Event from "./Mirakurun/Event";
import Job from "./Mirakurun/Job";
import * as log from "./Mirakurun/log";
import Program from "./Mirakurun/Program";
import Server from "./Mirakurun/Server";
import Service from "./Mirakurun/Service";
import status from "./Mirakurun/status";
import Tuner from "./Mirakurun/Tuner";
import recording from "./Recording/_";
import Encode from "./Recording/Encode";
import Recorded from "./Recording/Recorded";
import Recorder from "./Recording/Recorder";
import Reserve from "./Recording/Reserve";

(async function top() {
    _.config.server = await config.loadServer();
    _.config.channels = await config.loadChannels();
    _.configIntegrity.channels = createHash("sha256").update(JSON.stringify(_.config.channels)).digest("base64");
    _.config.tuners = await config.loadTuners();

    if (typeof _.config.server.logLevel === "number") {
        (<any>log).logLevel = _.config.server.logLevel;
    }
    if (typeof _.config.server.maxLogHistory === "number") {
        (<any>log).maxLogHistory = _.config.server.maxLogHistory;
    }

    _.event = new Event();
    _.job = new Job();
    _.tuner = new Tuner();
    _.channel = new Channel();
    _.service = new Service();
    _.program = new Program();
    _.server = new Server();

    await _.service.load();
    await _.program.load();

    if (process.env.SETUP === "true") {
        log.info("setup is done.");
        process.exit(0);
    }

    // Recording サブシステムの起動 (予約管理・録画実行・録画済み管理・エンコード)
    recording.reserve = new Reserve();
    recording.recorded = new Recorded();
    recording.recorder = new Recorder();
    recording.encode = new Encode();
    await recording.reserve.load();
    await recording.recorded.load();
    recording.recorder.scheduleAll();

    _.server.init();
})();
