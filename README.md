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

メニューバーの 🎆 から弾幕の停止/再開・終了ができる。

## 設定（.env）

| 変数 | 意味 |
|------|------|
| `WS_PORT` | 受信部と表示部をつなぐポート |
| `DISPLAY_INDEX` | 弾幕を出すディスプレイ番号（0=主モニタ, 1=2枚目 …） |
| `RENDERER` | 表示方式（`scroll`=右→左スクロール / `firework`=任意の点で弾けて上に拡散） |
| `SHOW_AUTHOR` | 送信者名の表示 |
| `SHOW_AVATAR` | 送信者アイコンの表示 |
| `FONT_SIZE` | 弾幕フォントサイズ(px) |
| `DANMAKU_SPEED` | スクロール速度(px/秒) |
| `MAX_CONCURRENT` | 同時表示の最大数（超過分はドロップ） |

## 設計

- 設計書: `docs/superpowers/specs/2026-08-26-hanabi-danmaku-overlay-design.md`
- 意思決定: `adr/`
