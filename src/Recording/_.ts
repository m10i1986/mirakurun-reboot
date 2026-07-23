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
import type Encode from "./Encode";
import type Recorded from "./Recorded";
import type Recorder from "./Recorder";
import type Reserve from "./Reserve";

interface Shared {
    reserve: Reserve;
    recorder: Recorder;
    recorded: Recorded;
    encode: Encode;
}

// 各プロパティは起動時 (src/server.ts の SETUP フェーズ) に必ず代入される
export const _ = {} as Shared;

export default _;
