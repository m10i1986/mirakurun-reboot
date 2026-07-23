/*
   Copyright 2021 kanreisa

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
import type { Program } from "../../../../api";
import _ from "../../_";
import Service from "../../Service";

const GENRE_LV1: { [key: number]: string } = {
    0: "ニュース／報道",
    1: "スポーツ",
    2: "情報／ワイドショー",
    3: "ドラマ",
    4: "音楽",
    5: "バラエティ",
    6: "映画",
    7: "アニメ／特撮",
    8: "ドキュメンタリー／教養",
    9: "劇場／公演",
    10: "趣味／教育",
    11: "福祉",
    12: "予備",
    13: "予備",
    14: "拡張",
    15: "その他",
};

const GENRE_LV2: { [key: number]: string } = {
    0: "定時・総合",
    1: "天気",
    2: "特集・ドキュメント",
    3: "政治・国会",
    4: "経済・市況",
    5: "海外・国際",
    6: "解説",
    7: "討論・会談",
    8: "報道特番",
    9: "ローカル・地域",
    10: "交通",
    15: "その他",
    16: "スポーツニュース",
    17: "野球",
    18: "サッカー",
    19: "ゴルフ",
    20: "その他の球技",
    21: "相撲・格闘技",
    22: "オリンピック・国際大会",
    23: "マラソン・陸上・水泳",
    24: "モータースポーツ",
    25: "マリン・ウィンタースポーツ",
    26: "競馬・公営競技",
    31: "その他",
    32: "芸能・ワイドショー",
    33: "ファッション",
    34: "暮らし・住まい",
    35: "健康・医療",
    36: "ショッピング・通販",
    37: "グルメ・料理",
    38: "イベント",
    39: "番組紹介・お知らせ",
    47: "その他",
    48: "国内ドラマ",
    49: "海外ドラマ",
    50: "時代劇",
    63: "その他",
    64: "国内ロック・ポップス",
    65: "海外ロック・ポップス",
    66: "クラシック・オペラ",
    67: "ジャズ・フュージョン",
    68: "歌謡曲・演歌",
    69: "ライブ・コンサート",
    70: "ランキング・リクエスト",
    71: "カラオケ・のど自慢",
    72: "民謡・邦楽",
    73: "童謡・キッズ",
    74: "民族音楽・ワールドミュージック",
    79: "その他",
    80: "クイズ",
    81: "ゲーム",
    82: "トークバラエティ",
    83: "お笑い・コメディ",
    84: "音楽バラエティ",
    85: "旅バラエティ",
    86: "料理バラエティ",
    95: "その他",
    96: "洋画",
    97: "邦画",
    98: "アニメ",
    111: "その他",
    112: "国内アニメ",
    113: "海外アニメ",
    114: "特撮",
    127: "その他",
    128: "社会・時事",
    129: "歴史・紀行",
    130: "自然・動物・環境",
    131: "宇宙・科学・医学",
    132: "カルチャー・伝統文化",
    133: "文学・文芸",
    134: "スポーツ",
    135: "ドキュメンタリー全般",
    136: "インタビュー・討論",
    143: "その他",
    144: "現代劇・新劇",
    145: "ミュージカル",
    146: "ダンス・バレエ",
    147: "落語・演芸",
    148: "歌舞伎・古典",
    159: "その他",
    160: "旅・釣り・アウトドア",
    161: "園芸・ペット・手芸",
    162: "音楽・美術・工芸",
    163: "囲碁・将棋",
    164: "麻雀・パチンコ",
    165: "車・オートバイ",
    166: "コンピュータ・ＴＶゲーム",
    167: "会話・語学",
    168: "幼児・小学生",
    169: "中学生・高校生",
    170: "大学生・受験",
    171: "生涯教育・資格",
    172: "教育問題",
    175: "その他",
    176: "高齢者",
    177: "障害者",
    178: "社会福祉",
    179: "ボランティア",
    180: "手話",
    181: "文字（字幕）",
    182: "音声解説",
    191: "その他",
    // 0xC0: "予備",
    // 0xD0: "予備",
    224: "BS/地上デジタル放送用番組付属情報",
    225: "広帯域CSデジタル放送用拡張",
    226: "衛星デジタル音声放送用拡張",
    227: "サーバー型番組付属情報",
    228: "IP放送用番組付属情報",
    240: "その他",
    255: "その他",
};

const GENRE_UNEX: { [key: number]: string } = {
    // BS/地上デジタル放送用番組付属情報
    0: "中止の可能性あり",
    1: "延長の可能性あり",
    2: "中断の可能性あり",
    3: "同一シリーズの別話数放送の可能性あり", // 地上デジタルテレビジョン放送で使用
    4: "編成未定枠",
    5: "繰り上げの可能性あり",
    16: "中断ニュースあり",
    17: "当該イベントに関連する臨時サービスあり",

    // 広帯域CSデジタル放送用拡張
    256: "スポーツ - テニス",
    257: "スポーツ - バスケットボール",
    258: "スポーツ - ラグビー",
    259: "スポーツ - アメリカンフットボール",
    260: "スポーツ - ボクシング",
    261: "スポーツ - プロレス",
    271: "スポーツ - その他",
    272: "洋画 - アクション",
    273: "洋画 - ＳＦ／ファンタジー",
    274: "洋画 - コメディー",
    275: "洋画 - サスペンス／ミステリー",
    276: "洋画 - 恋愛／ロマンス",
    277: "洋画 - ホラー／スリラー",
    278: "洋画 - ウエスタン",
    279: "洋画 - ドラマ／社会派ドラマ",
    280: "洋画 - アニメーション",
    281: "洋画 - ドキュメンタリー",
    282: "洋画 - アドベンチャー／冒険",
    283: "洋画 - ミュージカル／音楽映画",
    284: "洋画 - ホームドラマ",
    287: "洋画 - その他",
    288: "邦画 - アクション",
    289: "邦画 - ＳＦ／ファンタジー",
    290: "邦画 - お笑い／コメディー",
    291: "邦画 - サスペンス／ミステリー",
    292: "邦画 - 恋愛／ロマンス",
    293: "邦画 - ホラー／スリラー",
    294: "邦画 - 青春／学園／アイドル",
    295: "邦画 - 任侠／時代劇",
    296: "邦画 - アニメーション",
    297: "邦画 - ドキュメンタリー",
    298: "邦画 - アドベンチャー／冒険",
    299: "邦画 - ミュージカル／音楽映画",
    300: "邦画 - ホームドラマ",
    303: "邦画 - その他",
};

function escapeXMLSpecialChars(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function getDateTime(time: number): string {
    return `${new Date(time).toISOString().replace(/\..+$/, "").replace(/[-:T]/g, "")} +0000`;
}

function getGenreStrings(genres: Program["genres"]) {
    const stringSet = new Set<string>();

    for (const genre of genres ?? []) {
        if (genre.lv1 === 14) {
            // 拡張
            const text = GENRE_UNEX[genre.lv2 * 0x100 + genre.un1 * 0x10 + genre.un2];
            if (text) {
                stringSet.add(text);
            }
        } else {
            // 標準
            stringSet.add(`${GENRE_LV1[genre.lv1]} - ${GENRE_LV2[genre.lv1 * 0x10 + genre.lv2]}`);
        }
    }

    return [...stringSet.values()];
}

export const get: Operation = async (req, res) => {
    const apiRoot = `${req.protocol}://${req.headers.host}/api`;

    const services = [..._.service.items]; // shallow copy
    services.sort((a, b) => a.getOrder() - b.getOrder());

    let x = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    x += `<!DOCTYPE tv SYSTEM "xmltv.dtd">\n`;
    x += `<tv source-info-name="Mirakurun">\n`;

    const countMap = new Map<number, number>();
    for (const service of services) {
        if (service.type !== 1 && service.type !== 173) {
            continue;
        }

        const mainNum = service.remoteControlKeyId || service.serviceId;
        if (countMap.has(mainNum)) {
            countMap.set(mainNum, countMap.get(mainNum)! + 1);
        } else {
            countMap.set(mainNum, 1);
        }
        const subNum = countMap.get(mainNum);

        x += `<channel id="${service.id}">\n`;
        x += `<display-name>${escapeXMLSpecialChars(service.name)}</display-name>\n`;
        x += `<display-name>${mainNum}.${subNum}</display-name>\n`;
        if (await Service.isLogoDataExists(service.networkId, service.logoId)) {
            x += `<icon src="${apiRoot}/services/${service.id}/logo" />`;
        }
        x += `</channel>\n`;
    }

    for (const program of _.program.itemMap.values()) {
        const service = _.service.get(program.networkId, program.serviceId);
        if (service === null) {
            continue;
        }
        x += `<programme start="${getDateTime(program.startAt)}" stop="${getDateTime(program.startAt + program.duration)}" channel="${service.id}">\n`;
        x += `<title>${escapeXMLSpecialChars(program.name || "")}</title>\n`;
        x += `<desc>${escapeXMLSpecialChars(program.description || "")}</desc>\n`;
        if (program.genres) {
            const genreStrings = getGenreStrings(program.genres);
            for (const genreString of genreStrings) {
                x += `<category>${genreString}</category>\n`;
            }
        }
        x += `</programme>\n`;
    }

    x += `</tv>`;

    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.status(200);
    res.end(x);
};

get.apiDoc = {
    tags: ["iptv"],
    summary: "IPTV - XMLTV EPG Data",
    produces: ["text/xml"],
    responses: {
        200: {
            description: "OK",
        },
        default: {
            description: "Unexpected Error",
            schema: {
                $ref: "#/definitions/Error",
            },
        },
    },
};
