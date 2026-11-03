const { describe, it } = require("node:test");
const assert = require("assert");
const util = require("../lib/Recording/util");

describe("[recording.spec] Recording/util.ts: sanitizeFilename()", () => {
    it("replaces forbidden characters", () => {
        assert.strictEqual(util.sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), "a／b＼c：d＊e？f”g＜h＞i｜j");
    });

    it("removes control characters and trims", () => {
        assert.strictEqual(util.sanitizeFilename("  a\tb\nc  "), "abc");
    });
});

describe("[recording.spec] Recording/util.ts: buildRecordedFilename()", () => {
    const program = {
        id: 327360102420221,
        eventId: 20221,
        serviceId: 1024,
        networkId: 32736,
        startAt: new Date(2026, 5, 12, 21, 30, 0).getTime(),
        duration: 30 * 60 * 1000,
        isFree: true,
        name: "ニュース/天気",
    };

    it("builds filename from template", () => {
        const filename = util.buildRecordedFilename(
            "<year><month><day>-<hour><min>_<service>_<name>.m2ts",
            program,
            "テストTV",
            "GR",
        );
        assert.strictEqual(filename, "20260612-2130_テストTV_ニュース／天気.m2ts");
    });

    it("supports id variables", () => {
        const filename = util.buildRecordedFilename("<nid>-<sid>-<eid>.m2ts", program, "svc", "GR");
        assert.strictEqual(filename, "32736-1024-20221.m2ts");
    });
});
