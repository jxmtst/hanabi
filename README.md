# hanabi

Discord の特定チャンネルのメッセージを、ニコニコ動画風の弾幕として macOS 画面全体に
リアルタイム表示するツール。

## セットアップ

1. `npm install`
2. Discord Developer Portal で Bot を作成し、トークンを取得。
   **Bot → Privileged Gateway Intents → Message Content Intent を ON にする。**
3. Bot を対象サーバーに招待（`View Channels` / `Read Message History` 権限）。
4. `.env.example` を `.env` にコピーし、`DISCORD_BOT_TOKEN` と `CHANNEL_ID` を設定。

## 起動

receiver と overlay を同時に起動:

```bash
make
```

終了するときは `Ctrl-C` を押す。個別に起動する場合は `make receiver` または
`make overlay` を使う。

メニューバーの 🎆 から表示に関わる設定をすべて切り替えられる：

- 弾幕の停止/再開
- 表示方式（スクロール / 花火）
- 表示画面（モニタ）
- 文字サイズ（小 / 中 / 大 / 特大）
- 速度（遅い / 標準 / 速い / 爆速）
- 最大表示数（20 / 40 / 80 / 無制限）
- 送信者名（表示 / 非表示）
- アイコン（なし / 小 / 中 / 大 / 特大）
- 絵文字サイズ（小 / 中 / 大 / 特大）

表示に関わる設定はすべてメニューバーから変更する（上記参照）。`.env` には接続に必要な設定のみを置く。

## 設定（.env）

| 変数 | 意味 |
|------|------|
| `DISCORD_BOT_TOKEN` | Discord Bot のトークン |
| `CHANNEL_ID` | 弾幕として流す対象チャンネルの ID |
| `WS_PORT` | 受信部と表示部をつなぐポート |

## 設計

- 設計書: `docs/superpowers/specs/2026-08-26-hanabi-danmaku-overlay-design.md`
- 意思決定: `adr/`
