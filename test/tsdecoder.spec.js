const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const stream = require("node:stream");

// status は import するだけで再スケジュールされるタイマーを起動し続けテストプロセスが終了しなくなるため、スタブに差し替える
const statusPath = require.resolve("../lib/Mirakurun/status");
require.cache[statusPath] = {
    id: statusPath,
    filename: statusPath,
    loaded: true,
    exports: { __esModule: true, default: { streamCount: { decoder: 0 }, errorCount: { decoderRespawn: 0 } } },
};

const log = require("../lib/Mirakurun/log");
const TSDecoder = require("../lib/Mirakurun/TSDecoder").default;

// 条件が成立するまで待つ
async function waitFor(predicate, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (predicate() === false) {
        if (Date.now() > deadline) {
            throw new Error("timeout waiting for condition");
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

// TSDecoder を起動して TS を流し続け、ログを収集する
function startDecoder(command) {
    const lines = [];
    // log.event の data イベントにはログ文字列だけが渡される
    const onLog = (line) => lines.push(line);
    log.event.on("data", onLog);

    const output = new stream.PassThrough();
    output.resume();
    const decoder = new TSDecoder({ output, command });
    const timer = setInterval(() => decoder.write(Buffer.alloc(188 * 10)), 50);

    return {
        lines,
        stop() {
            clearInterval(timer);
            output.destroy();
            log.event.off("data", onLog);
        },
    };
}

describe("[tsdecoder.spec] TSDecoder.ts: decoder process failures", () => {
    it("Missing command is reported once per respawn cycle with the command name", { timeout: 15000 }, async () => {
        const command = "mirakurun-test-nonexistent-decoder";
        const { lines, stop } = startDecoder(command);
        try {
            await waitFor(() => lines.some((line) => line.includes("respawning because dead (count=1)")), 5000);

            // 起動失敗の原因 (コマンド名) がログに出る
            assert.ok(lines.some((line) => line.includes("process error") && line.includes(command)));
            // 起動失敗 (error) と close の両方で数えず、起動失敗 1 回につき死亡は 1 回だけ数える
            const errors = lines.filter((line) => line.includes("process error")).length;
            const deads = lines.filter((line) => line.includes("unexpected dead")).length;
            assert.ok(errors >= 1);
            assert.strictEqual(deads, errors);
            const respawn = lines.find((line) => line.includes("respawning because dead"));
            assert.ok(respawn.includes("(count=1)"), respawn);
        } finally {
            stop();
        }
    });

    it("Silent decoder killed by the response timeout is counted once per respawn cycle", {
        timeout: 15000,
    }, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tsdecoder-spec-"));
        const command = path.join(dir, "silent-decoder.sh");
        fs.writeFileSync(command, "#!/bin/sh\ncat > /dev/null\n", { mode: 0o755 });

        const { lines, stop } = startDecoder(command);
        try {
            await waitFor(() => lines.some((line) => line.includes("respawning because dead")), 8000);

            // kill 後の close で _dead() が再度呼ばれると count=2 から始まってしまう
            const respawn = lines.find((line) => line.includes("respawning because dead"));
            assert.ok(respawn.includes("(count=1)"), respawn);
            assert.strictEqual(lines.filter((line) => line.includes("unexpected dead")).length, 1);
        } finally {
            stop();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
