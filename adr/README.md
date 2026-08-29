# Architecture Decision Records (ADR)

このディレクトリは、プロジェクト「hanabi」（Discord の特定チャンネルのメッセージを、ニコニコ動画風の弾幕として macOS 画面上にリアルタイム表示するツール）における重要な設計上の意思決定を記録します。

## ADR とは

ADR（Architecture Decision Record）は、「なぜその設計を選んだか」を後から追えるように、決定・背景・結果を1件1ファイルで残す軽量なドキュメントです。決定は原則として上書きせず、覆す場合は新しい ADR を追加して古い ADR を `Superseded`（廃止）にします。

## Status の凡例

- **Proposed** — 提案中
- **Accepted** — 採用（有効）
- **Superseded by ADR-XXXX** — 別の ADR により置き換え済み
- **Deprecated** — 廃止

## 一覧

| No. | タイトル | Status |
|-----|----------|--------|
| [0001](0001-use-electron.md) | オーバーレイの実装基盤に Electron を採用する | Accepted |
| [0002](0002-two-layer-architecture.md) | 受信部と表示部を分離した二層アーキテクチャを採用する | Accepted |
| [0003](0003-runtime-settings-via-menu-bar.md) | 表示設定はメニューバーから実行時に変更し set-options IPC に一本化する | Accepted |
