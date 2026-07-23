# 録画機能 (EPGStation マージ)

[EPGStation](https://github.com/l3tnun/EPGStation) の録画予約管理機能を Mirakurun 本体にマージしたものです。
実装は `src/EPGStation/` に配置されていますが、システムとしては Mirakurun の一部として動作します。
外部プロセス・外部 DB は不要で、チューナーストリームはプロセス内で直接取得します。

## 機能

- **手動予約**: 番組を指定して予約 (`POST /api/reserves`)
- **ルール予約**: キーワード / サービス / チャンネル種別 / ジャンル / 曜日 / 時間帯 による自動予約
- **録画**: 番組単位の TS 録画 (開始マージン / EIT による番組終了検出 / 強制停止の保険つき)
- **録画済み管理**: 一覧・ダウンロード・削除 (ファイルごと削除)
- **番組表 (ラテ欄)**: チャンネル種別ごとの番組表から予約・キャンセル
- **サムネイル**: 録画ファイルから ffmpeg で自動生成 (`GET /api/recorded/{id}/thumbnail`)
- **ストリーミング再生**: ffmpeg によるリアルタイムトランスコード再生 (fMP4)
- **エンコード**: プリセット定義によるエンコードキュー (進捗表示 / 元ファイル削除オプション)
- **ストレージ表示**: 録画ディレクトリの空き容量 (`GET /api/storage`)
- **Web UI**: `Recording` タブ (Dashboard / Guide / Search / Reserves / Rules / Recorded / Encode)

サムネイル・ストリーミング再生・エンコードには `ffmpeg` が必要です
(PATH 上にない場合は `recording.ffmpegPath` か環境変数 `FFMPEG_PATH` で指定)。

## 設定

`server.yml` の `recording` セクションで設定します。すべて省略可能です。

```yaml
recording:
  recordedDirPath: /usr/local/var/db/mirakurun/recorded
  recordedFormat: "<year><month><day>-<hour><min>_<service>_<name>.m2ts"
  startMarginMs: 15000   # チューナーを番組開始より早く開く時間
  endMarginMs: 15000     # 番組終了検出の猶予
  priority: 2            # 録画時のチューナー優先度
  ffmpegPath: ffmpeg     # サムネイル / 再生 / エンコードに使用
  thumbnailPositionSec: 5
  maxEncode: 1           # エンコードの並列実行数
  # streamCommand: "%FFMPEG% -ss <ss> -i <input> ... pipe:1"  # 再生用コマンドの上書き
  encoders:              # 省略時は H.264 (mp4) プリセットのみ
    - name: H.264
      command: "%FFMPEG% -dual_mono_mode main -i <input> -sn -threads 0 -c:a aac -ar 48000 -b:a 192k -ac 2 -c:v libx264 -vf yadif,scale=-2:1080 -crf 23 -preset veryfast -y -f mp4 -movflags +faststart <output>"
      suffix: .mp4
```

エンコードコマンドの `%FFMPEG%` は `ffmpegPath`、`<input>` / `<output>` はファイルパスに置換されます
(トークン単位で置換するため空白を含むパスも安全です)。エンコード完了後は録画済み一覧に
`<元の名前> [プリセット名]` として登録されます。

`recordedFormat` で使用可能な変数:
`<year> <month> <day> <hour> <min> <sec> <name> <service> <sid> <nid> <eid> <type>`

### 環境変数

| 環境変数 | デフォルト |
|---|---|
| `RESERVES_DB_PATH` | `/usr/local/var/db/mirakurun/reserves.json` |
| `RULES_DB_PATH` | `/usr/local/var/db/mirakurun/rules.json` |
| `RECORDED_DB_PATH` | `/usr/local/var/db/mirakurun/recorded.json` |
| `RECORDED_DIR_PATH` | `/usr/local/var/db/mirakurun/recorded` |

Docker / Podman では `/app-data` 配下にマップされます (`docker/container-init.sh`)。
録画ファイルを別ボリュームに置く場合は `RECORDED_DIR_PATH` を上書きしてください。

## API

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/reserves` | 予約一覧 |
| POST | `/api/reserves` | 手動予約 `{ programId, priority? }` |
| GET / PUT / DELETE | `/api/reserves/{id}` | 予約の取得 / 更新 / キャンセル+削除 |
| GET / POST | `/api/rules` | ルール一覧 / 作成 |
| GET / PUT / DELETE | `/api/rules/{id}` | ルールの取得 / 更新 / 削除 |
| GET | `/api/recorded` | 録画済み一覧 |
| GET / DELETE | `/api/recorded/{id}` | 録画済みの取得 / 削除 (ファイルごと) |
| GET | `/api/recorded/{id}/file` | 録画ファイル取得 (Range 対応) |
| GET | `/api/recorded/{id}/thumbnail` | サムネイル取得 (初回アクセス時に ffmpeg で生成) |
| GET | `/api/recorded/{id}/stream` | トランスコード再生 `?ss=<開始秒>` (video/mp4) |
| GET | `/api/schedules` | 番組表 `?type=GR&start=&end=` (unixtime ms, 最大48時間) |
| GET | `/api/schedules/search` | 番組検索 `?keyword=&serviceId=&limit=` |
| GET | `/api/storage` | 録画ディレクトリのストレージ情報 |
| GET / POST | `/api/encode` | エンコードキュー一覧 / 追加 `{ recordedId, encoderName?, removeOriginal? }` |
| GET / DELETE | `/api/encode/{id}` | エンコードの取得 / キャンセル (終了済みは一覧から削除) |
| GET | `/api/encoders` | エンコーダープリセット一覧 |

イベントストリーム (`/api/events/stream`, RPC) には `reserve` / `rule` / `recorded` / `encode` リソースが追加されています。

## ルールの検索条件 (`search`)

```jsonc
{
  "keyword": "アニメ 新番組",       // スペース区切り AND (番組名+説明)
  "ignoreKeyword": "再放送",        // 1つでも含めば除外
  "serviceIds": [3273601024],       // Mirakurun Service#id
  "channelTypes": ["GR", "BS"],
  "genreLv1s": [7],                 // ARIB ジャンル大分類
  "weekdays": [0, 6],               // 0=日曜
  "startHour": 22,
  "endHour": 26                     // 24超で日跨ぎ指定可
}
```
