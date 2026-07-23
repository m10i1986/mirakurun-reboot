const { describe, it } = require("node:test");
const assert = require("assert");
const util = require("../lib/EPGStation/util");
const { matchesRule } = require("../lib/EPGStation/Rule");

describe("[epgstation.spec] EPGStation/util.ts: sanitizeFilename()", () => {
    it("replaces forbidden characters", () => {
        assert.strictEqual(util.sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), "a／b＼c：d＊e？f”g＜h＞i｜j");
    });

    it("removes control characters and trims", () => {
        assert.strictEqual(util.sanitizeFilename("  a\tb\nc  "), "abc");
    });
});

describe("[epgstation.spec] EPGStation/util.ts: buildRecordedFilename()", () => {
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

describe("[epgstation.spec] EPGStation/Rule.ts: matchesRule()", () => {
    const baseProgram = {
        id: 327360102420221,
        eventId: 20221,
        serviceId: 1024,
        networkId: 32736,
        startAt: new Date(2026, 5, 12, 21, 30, 0).getTime(), // Friday 21:30
        duration: 30 * 60 * 1000,
        isFree: true,
        name: "アニメ大百科",
        description: "アニメの紹介番組",
        genres: [{ lv1: 7, lv2: 0, un1: 15, un2: 15 }],
    };

    it("matches by keyword (AND)", () => {
        assert.strictEqual(matchesRule({ keyword: "アニメ 大百科" }, baseProgram), true);
        assert.strictEqual(matchesRule({ keyword: "アニメ ドラマ" }, baseProgram), false);
    });

    it("matches keyword against description", () => {
        assert.strictEqual(matchesRule({ keyword: "紹介番組" }, baseProgram), true);
    });

    it("excludes by ignoreKeyword", () => {
        assert.strictEqual(matchesRule({ keyword: "アニメ", ignoreKeyword: "紹介" }, baseProgram), false);
    });

    it("matches by genre lv1", () => {
        assert.strictEqual(matchesRule({ genreLv1s: [7] }, baseProgram), true);
        assert.strictEqual(matchesRule({ genreLv1s: [1] }, baseProgram), false);
    });

    it("matches by weekday", () => {
        assert.strictEqual(matchesRule({ weekdays: [5] }, baseProgram), true); // Friday
        assert.strictEqual(matchesRule({ weekdays: [0, 6] }, baseProgram), false);
    });

    it("matches by hour range", () => {
        assert.strictEqual(matchesRule({ startHour: 20, endHour: 23 }, baseProgram), true);
        assert.strictEqual(matchesRule({ startHour: 8, endHour: 12 }, baseProgram), false);
    });

    it("matches by over-midnight hour range", () => {
        assert.strictEqual(matchesRule({ startHour: 21, endHour: 26 }, baseProgram), true);
        const lateNight = { ...baseProgram, startAt: new Date(2026, 5, 13, 1, 0, 0).getTime() };
        assert.strictEqual(matchesRule({ startHour: 21, endHour: 26 }, lateNight), true);
        assert.strictEqual(matchesRule({ startHour: 21, endHour: 24 }, lateNight), false);
    });

    it("matches by serviceIds", () => {
        assert.strictEqual(matchesRule({ serviceIds: [3273601024] }, baseProgram), true);
        assert.strictEqual(matchesRule({ serviceIds: [3273601025] }, baseProgram), false);
    });

    it("does not match program without name", () => {
        assert.strictEqual(matchesRule({ keyword: "アニメ" }, { ...baseProgram, name: undefined }), false);
    });
});
