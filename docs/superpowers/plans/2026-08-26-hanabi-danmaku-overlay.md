# hanabi 弾幕オーバーレイ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord の特定チャンネルの新着メッセージを、ニコニコ動画風の右→左スクロール弾幕として macOS 画面全体に透明・最前面・完全クリックスルーでリアルタイム表示する MVP を作る。

**Architecture:** 受信部（Node + discord.js）と表示部（Electron）を分離し、ローカル WebSocket で接続する二層構成。受信部は Discord メッセージを正規化スキーマへ変換して WS でブロードキャストし、表示部はそれを受信して弾幕描画する。詳細は `docs/superpowers/specs/2026-08-26-hanabi-danmaku-overlay-design.md`、決定は `adr/` を参照。

**Tech Stack:** Node.js (ESM, v18+) / discord.js v14 / ws v8 / Electron v31 / dotenv / Node 標準テストランナー (`node:test`)。プレーン JavaScript（TypeScript は使わない）。

---

## ファイル構成

```
hanabi/
├── package.json                    プロジェクト定義・依存・スクリプト
├── .gitignore                      node_modules, .env などを除外
├── .env.example                    設定サンプル（実値は .env に）
├── src/
│   ├── config.js                   .env を読み込み設定オブジェクトを提供
│   ├── receiver/
│   │   ├── index.js                受信部エントリ（discord接続＋bridge起動）
│   │   ├── formatter.js            純粋関数群（URL短縮・segment分割・normalize）
│   │   ├── bridge.js               ローカル WS サーバ（broadcast）
│   │   └── discord-client.js       discord.js の配線（Message→normalize）
│   └── overlay/
│       ├── main.js                 Electron main（透明窓＋Tray）
│       ├── preload.js              renderer へ toggle イベントを橋渡し
│       ├── index.html              オーバーレイの土台
│       └── renderer/
│           ├── renderer.js         WSクライアント＋描画ディスパッチ
│           ├── danmaku.js          レンダラ登録レジストリ（差し替え可能IF）
│           ├── scroll-renderer.js  右→左スクロール実装
│           └── styles.css          弾幕スタイル
└── test/
    ├── formatter.test.js
    └── bridge.test.js
```

正規化メッセージのスキーマ（受信部→表示部の唯一の契約。全タスクで共通）:

```json
{
  "id": "string",
  "author": { "name": "string", "avatarUrl": "string|null" },
  "text": "string",
  "segments": [
    { "type": "text", "value": "string" },
    { "type": "emoji", "url": "string", "name": "string" }
  ],
  "timestamp": 1700000000000
}
```

---

## Task 1: プロジェクト雛形と依存の準備

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: `.gitignore` を作成**

```gitignore
node_modules/
.env
dist/
*.log
.DS_Store
```

- [ ] **Step 2: `.env.example` を作成**

```dotenv
# Discord Bot のトークン（Developer Portal で取得。Message Content Intent を有効化すること）
DISCORD_BOT_TOKEN=your-bot-token-here
# 弾幕として流す対象チャンネルの ID
CHANNEL_ID=000000000000000000

# 受信部と表示部をつなぐローカル WebSocket ポート
WS_PORT=8787

# 表示オプション
SHOW_AUTHOR=true        # 送信者名を表示するか
SHOW_AVATAR=false       # 送信者アイコンを表示するか
FONT_SIZE=28            # 弾幕フォントサイズ(px)
DANMAKU_SPEED=140       # スクロール速度(px/秒)
MAX_CONCURRENT=40       # 同時に画面に出す最大数（超過分はドロップ）
```

- [ ] **Step 3: `package.json` を作成**

```json
{
  "name": "hanabi",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Discord のメッセージをニコニコ風の弾幕として macOS 画面に表示する",
  "main": "src/overlay/main.js",
  "scripts": {
    "test": "node --test",
    "receiver": "node src/receiver/index.js",
    "overlay": "electron .",
    "start": "echo 'Run \"npm run receiver\" and \"npm run overlay\" in separate terminals'"
  },
  "dependencies": {
    "discord.js": "^14.15.0",
    "dotenv": "^16.4.0",
    "ws": "^8.17.0"
  },
  "devDependencies": {
    "electron": "^31.0.0"
  }
}
```

- [ ] **Step 4: 依存をインストール**

Run: `npm install`
Expected: `node_modules/` が作成され、エラーなく完了する。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: プロジェクト雛形と依存を追加"
```

---

## Task 2: 設定ローダ `config.js`

**Files:**
- Create: `src/config.js`

- [ ] **Step 1: `src/config.js` を作成**

`.env` を読み込み、型変換済みの設定を1オブジェクトで返す。秘密情報の存在チェックも行う。

```js
import 'dotenv/config';

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  botToken: process.env.DISCORD_BOT_TOKEN ?? '',
  channelId: process.env.CHANNEL_ID ?? '',
  wsPort: num(process.env.WS_PORT, 8787),
  showAuthor: bool(process.env.SHOW_AUTHOR, true),
  showAvatar: bool(process.env.SHOW_AVATAR, false),
  fontSize: num(process.env.FONT_SIZE, 28),
  danmakuSpeed: num(process.env.DANMAKU_SPEED, 140),
  maxConcurrent: num(process.env.MAX_CONCURRENT, 40),
};

// 受信部でのみ必須の値を検証する（表示部では呼ばない）
export function assertReceiverConfig() {
  if (!config.botToken) throw new Error('DISCORD_BOT_TOKEN が未設定です (.env を確認)');
  if (!config.channelId) throw new Error('CHANNEL_ID が未設定です (.env を確認)');
}
```

- [ ] **Step 2: 読み込みを確認**

Run: `node -e "import('./src/config.js').then(m => console.log(m.config.wsPort))"`
Expected: `8787`（または .env の値）が出力される。

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "feat: 設定ローダを追加"
```

---

## Task 3: formatter — URL 短縮（TDD）

**Files:**
- Create: `src/receiver/formatter.js`
- Test: `test/formatter.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/formatter.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText } from '../src/receiver/formatter.js';

test('formatText: パス付き URL はホスト+省略記号に短縮する', () => {
  assert.equal(
    formatText('見て https://www.example.com/very/long/path これ'),
    '見て example.com/… これ',
  );
});

test('formatText: パスなし URL はホストのみにする', () => {
  assert.equal(formatText('https://example.com'), 'example.com');
});

test('formatText: URL を含まない文字列はそのまま返す', () => {
  assert.equal(formatText('やっほー'), 'やっほー');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/formatter.test.js`
Expected: FAIL（`formatText` が存在しない、またはモジュール解決エラー）。

- [ ] **Step 3: 最小実装を書く**

`src/receiver/formatter.js`:

```js
const URL_RE = /https?:\/\/[^\s]+/g;

export function shortenUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const hasPath = (u.pathname && u.pathname !== '/') || u.search || u.hash;
    return hasPath ? `${host}/…` : host;
  } catch {
    return url;
  }
}

export function formatText(content) {
  return content.replace(URL_RE, (m) => shortenUrl(m));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/formatter.test.js`
Expected: PASS（3 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/receiver/formatter.js test/formatter.test.js
git commit -m "feat: メッセージ本文の URL 短縮を追加"
```

---

## Task 4: formatter — segment 分割（TDD）

**Files:**
- Modify: `src/receiver/formatter.js`
- Test: `test/formatter.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記**

`test/formatter.test.js` の末尾に追記:

```js
import { parseSegments } from '../src/receiver/formatter.js';

test('parseSegments: テキストとカスタム絵文字を分割する', () => {
  assert.deepEqual(parseSegments('やっほー <:wave:123>'), [
    { type: 'text', value: 'やっほー ' },
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/123.png', name: 'wave' },
  ]);
});

test('parseSegments: アニメーション絵文字は gif になる', () => {
  assert.deepEqual(parseSegments('<a:dance:456>'), [
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/456.gif', name: 'dance' },
  ]);
});

test('parseSegments: テキスト部分には URL 短縮が適用される', () => {
  assert.deepEqual(parseSegments('https://example.com/x <:wave:123>'), [
    { type: 'text', value: 'example.com/… ' },
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/123.png', name: 'wave' },
  ]);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/formatter.test.js`
Expected: FAIL（`parseSegments` が存在しない）。

- [ ] **Step 3: 最小実装を追記**

`src/receiver/formatter.js` の末尾に追記:

```js
// <:name:id> または <a:name:id>（アニメーション）にマッチ
const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;

export function parseSegments(content) {
  const segments = [];
  let lastIndex = 0;
  let match;

  const pushText = (raw) => {
    if (!raw) return;
    segments.push({ type: 'text', value: formatText(raw) });
  };

  EMOJI_RE.lastIndex = 0;
  while ((match = EMOJI_RE.exec(content)) !== null) {
    pushText(content.slice(lastIndex, match.index));
    const [, animated, name, id] = match;
    const ext = animated ? 'gif' : 'png';
    segments.push({
      type: 'emoji',
      url: `https://cdn.discordapp.com/emojis/${id}.${ext}`,
      name,
    });
    lastIndex = match.index + match[0].length;
  }
  pushText(content.slice(lastIndex));
  return segments;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/formatter.test.js`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/receiver/formatter.js test/formatter.test.js
git commit -m "feat: 本文をテキスト/絵文字の segment に分割する処理を追加"
```

---

## Task 5: formatter — normalize（TDD）

**Files:**
- Modify: `src/receiver/formatter.js`
- Test: `test/formatter.test.js`（追記）

- [ ] **Step 1: 失敗するテストを追記**

```js
import { normalize } from '../src/receiver/formatter.js';

test('normalize: 正規化スキーマのオブジェクトを組み立てる', () => {
  const result = normalize({
    id: 'm1',
    authorName: 'ゆーざー',
    authorAvatarUrl: 'https://cdn/av.png',
    content: 'やっほー <:wave:123>',
    timestamp: 1700000000000,
  });
  assert.deepEqual(result, {
    id: 'm1',
    author: { name: 'ゆーざー', avatarUrl: 'https://cdn/av.png' },
    text: 'やっほー <:wave:123>',
    segments: [
      { type: 'text', value: 'やっほー ' },
      { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/123.png', name: 'wave' },
    ],
    timestamp: 1700000000000,
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/formatter.test.js`
Expected: FAIL（`normalize` が存在しない）。

- [ ] **Step 3: 最小実装を追記**

`src/receiver/formatter.js` の末尾に追記。`text` は URL 短縮のみ適用したフォールバック文字列だが、テスト期待に合わせ生 content を保持する（絵文字トークンは segments 側で解決するため text はそのまま）:

```js
export function normalize({ id, authorName, authorAvatarUrl, content, timestamp }) {
  return {
    id,
    author: { name: authorName, avatarUrl: authorAvatarUrl ?? null },
    text: content,
    segments: parseSegments(content),
    timestamp,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/formatter.test.js`
Expected: PASS（7 tests）。

- [ ] **Step 5: Commit**

```bash
git add src/receiver/formatter.js test/formatter.test.js
git commit -m "feat: Discord メッセージの正規化関数を追加"
```

---

## Task 6: bridge — ローカル WS ブロードキャスト（TDD）

**Files:**
- Create: `src/receiver/bridge.js`
- Test: `test/bridge.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`test/bridge.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createBridge } from '../src/receiver/bridge.js';

test('createBridge: 接続中のクライアントに JSON をブロードキャストする', async () => {
  const bridge = createBridge(0); // 0 = OS が空きポートを割り当て
  const port = await bridge.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  const received = new Promise((resolve) => {
    client.on('message', (data) => resolve(JSON.parse(data.toString())));
  });
  await new Promise((resolve) => client.on('open', resolve));

  bridge.broadcast({ id: 'm1', text: 'hi' });
  const msg = await received;
  assert.deepEqual(msg, { id: 'm1', text: 'hi' });

  client.close();
  await bridge.close();
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test test/bridge.test.js`
Expected: FAIL（`createBridge` が存在しない）。

- [ ] **Step 3: 最小実装を書く**

`src/receiver/bridge.js`:

```js
import { WebSocketServer } from 'ws';

export function createBridge(port) {
  const wss = new WebSocketServer({ host: '127.0.0.1', port });

  const readyPromise = new Promise((resolve, reject) => {
    wss.on('listening', () => resolve(wss.address().port));
    wss.on('error', reject);
  });

  return {
    ready: () => readyPromise,
    broadcast(obj) {
      const data = JSON.stringify(obj);
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(data);
      }
    },
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test test/bridge.test.js`
Expected: PASS（1 test）。

- [ ] **Step 5: 全テストを通しで確認**

Run: `npm test`
Expected: PASS（formatter 7 + bridge 1 = 8 tests）。

- [ ] **Step 6: Commit**

```bash
git add src/receiver/bridge.js test/bridge.test.js
git commit -m "feat: ローカル WS ブロードキャスト bridge を追加"
```

---

## Task 7: discord-client — Message を normalize へ配線

**Files:**
- Create: `src/receiver/discord-client.js`

このモジュールは discord.js に依存し GUI/ネットワークを伴うため、ユニットテストは行わず Task 8 の手動起動で検証する。

- [ ] **Step 1: `src/receiver/discord-client.js` を作成**

```js
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { normalize } from './formatter.js';

/**
 * Discord に接続し、対象チャンネルのメッセージを normalize して onMessage に渡す。
 * @param {{ token: string, channelId: string }} opts
 * @param {(msg: object) => void} onMessage
 * @returns {Client}
 */
export function startDiscordClient({ token, channelId }, onMessage) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[receiver] Discord 接続完了: ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, (message) => {
    if (message.channelId !== channelId) return;
    if (message.author.bot) return;
    onMessage(
      normalize({
        id: message.id,
        authorName: message.member?.displayName ?? message.author.username,
        authorAvatarUrl: message.author.displayAvatarURL({ size: 64 }),
        content: message.content,
        timestamp: message.createdTimestamp,
      }),
    );
  });

  client.login(token);
  return client;
}
```

- [ ] **Step 2: 構文エラーがないことを確認**

Run: `node --check src/receiver/discord-client.js`
Expected: 出力なし（構文 OK）。

- [ ] **Step 3: Commit**

```bash
git add src/receiver/discord-client.js
git commit -m "feat: discord.js クライアントの配線を追加"
```

---

## Task 8: 受信部エントリ `receiver/index.js`

**Files:**
- Create: `src/receiver/index.js`

- [ ] **Step 1: `src/receiver/index.js` を作成**

```js
import { config, assertReceiverConfig } from '../config.js';
import { createBridge } from './bridge.js';
import { startDiscordClient } from './discord-client.js';

assertReceiverConfig();

const bridge = createBridge(config.wsPort);
bridge.ready().then((port) => {
  console.log(`[receiver] WS bridge listening on ws://127.0.0.1:${port}`);
});

startDiscordClient(
  { token: config.botToken, channelId: config.channelId },
  (msg) => {
    console.log(`[receiver] ${msg.author.name}: ${msg.text}`);
    bridge.broadcast(msg);
  },
);

process.on('SIGINT', async () => {
  await bridge.close();
  process.exit(0);
});
```

- [ ] **Step 2: 手動起動して Discord 接続を確認**

事前準備: `.env.example` を `.env` にコピーし、実際の `DISCORD_BOT_TOKEN` と `CHANNEL_ID` を設定。Bot は対象サーバーに招待済みで Message Content Intent を有効化しておくこと。

Run: `npm run receiver`
Expected: `[receiver] Discord 接続完了: <botの名前>` と `WS bridge listening ...` が表示される。対象チャンネルに投稿すると `[receiver] <名前>: <本文>` が出力される。確認できたら Ctrl-C で停止。

- [ ] **Step 3: Commit**

```bash
git add src/receiver/index.js
git commit -m "feat: 受信部エントリを追加（Discord受信→WSブロードキャスト）"
```

---

## Task 9: Electron 透明オーバーレイ窓 + Tray

**Files:**
- Create: `src/overlay/main.js`
- Create: `src/overlay/preload.js`
- Create: `src/overlay/index.html`

- [ ] **Step 1: `src/overlay/index.html` を作成**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="renderer/styles.css" />
  </head>
  <body>
    <div id="stage"></div>
    <script type="module" src="renderer/renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 2: `src/overlay/preload.js` を作成**

Tray からの ON/OFF と WS ポートを renderer へ安全に渡す。

```js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hanabi', {
  wsPort: Number(process.env.HANABI_WS_PORT ?? 8787),
  fontSize: Number(process.env.HANABI_FONT_SIZE ?? 28),
  speed: Number(process.env.HANABI_SPEED ?? 140),
  maxConcurrent: Number(process.env.HANABI_MAX ?? 40),
  showAuthor: process.env.HANABI_SHOW_AUTHOR !== 'false',
  showAvatar: process.env.HANABI_SHOW_AVATAR === 'true',
  onToggle: (cb) => ipcRenderer.on('danmaku-toggle', (_e, enabled) => cb(enabled)),
});
```

- [ ] **Step 3: `src/overlay/main.js` を作成**

透明・全画面・最前面・クリックスルー窓と Tray を作る。設定は `config.js` から読み、preload へ環境変数で渡す。

```js
import { app, BrowserWindow, Tray, Menu, screen, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// preload に値を渡すため環境変数へ展開
process.env.HANABI_WS_PORT = String(config.wsPort);
process.env.HANABI_FONT_SIZE = String(config.fontSize);
process.env.HANABI_SPEED = String(config.danmakuSpeed);
process.env.HANABI_MAX = String(config.maxConcurrent);
process.env.HANABI_SHOW_AUTHOR = String(config.showAuthor);
process.env.HANABI_SHOW_AVATAR = String(config.showAvatar);

let win;
let tray;
let enabled = true;

function createWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true }); // 完全クリックスルー
  win.loadFile(path.join(__dirname, 'index.html'));
}

function createTray() {
  // テンプレート画像がない場合でも空の Tray を作れるよう空アイコンを使用
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('🎆');
  rebuildMenu();
}

function rebuildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: enabled ? '弾幕を停止' : '弾幕を再開',
      click: () => {
        enabled = !enabled;
        win?.webContents.send('danmaku-toggle', enabled);
        rebuildMenu();
      },
    },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 4: 透明窓と Tray の表示を手動確認**

Run: `npm run overlay`
Expected: 画面全体が透明のまま（何も見えないが背後をクリックできる）。メニューバーに `🎆` が出て、クリックすると「弾幕を停止」「終了」メニューが出る。「終了」で閉じる。

- [ ] **Step 5: Commit**

```bash
git add src/overlay/main.js src/overlay/preload.js src/overlay/index.html
git commit -m "feat: Electron 透明クリックスルー窓と Tray を追加"
```

---

## Task 10: 弾幕レンダラ登録レジストリ `danmaku.js`

**Files:**
- Create: `src/overlay/renderer/danmaku.js`

差し替え可能な表示方式のインターフェースを定義する。各レンダラは `{ name, create(stage, options) }` を満たし、`create` は `{ render(message), setPaused(bool) }` を返す。

- [ ] **Step 1: `src/overlay/renderer/danmaku.js` を作成**

```js
const registry = new Map();

/**
 * 表示方式を登録する。
 * @param {{ name: string, create: (stage: HTMLElement, options: object) => { render: Function, setPaused: Function } }} renderer
 */
export function registerRenderer(renderer) {
  registry.set(renderer.name, renderer);
}

export function getRenderer(name) {
  const r = registry.get(name);
  if (!r) throw new Error(`未登録の弾幕レンダラ: ${name}`);
  return r;
}
```

- [ ] **Step 2: 構文チェック**

Run: `node --check src/overlay/renderer/danmaku.js`
Expected: 出力なし。

- [ ] **Step 3: Commit**

```bash
git add src/overlay/renderer/danmaku.js
git commit -m "feat: 差し替え可能な弾幕レンダラ登録レジストリを追加"
```

---

## Task 11: 右→左スクロールレンダラ `scroll-renderer.js` とスタイル

**Files:**
- Create: `src/overlay/renderer/scroll-renderer.js`
- Create: `src/overlay/renderer/styles.css`

- [ ] **Step 1: `src/overlay/renderer/styles.css` を作成**

```css
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  pointer-events: none;
  font-family: -apple-system, "Hiragino Sans", sans-serif;
}
#stage { position: fixed; inset: 0; }

.danmaku {
  position: absolute;
  left: 0;
  white-space: nowrap;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 0 2px #000, 0 0 4px #000, 1px 1px 2px #000;
  will-change: transform;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.danmaku img.emoji { height: 1em; vertical-align: middle; }
.danmaku img.avatar { height: 1em; border-radius: 50%; }
.danmaku .author { opacity: 0.85; margin-right: 6px; }
```

- [ ] **Step 2: `src/overlay/renderer/scroll-renderer.js` を作成**

レーン管理で重なりを避け、CSS transition で右→左に流し、終了時に DOM とレーンを解放する。

```js
import { registerRenderer } from './danmaku.js';

const scrollRenderer = {
  name: 'scroll',
  create(stage, options) {
    const { fontSize, speed, maxConcurrent, showAuthor, showAvatar } = options;
    const laneHeight = Math.round(fontSize * 1.4);
    const laneCount = Math.max(1, Math.floor(window.innerHeight / laneHeight));
    const laneBusyUntil = new Array(laneCount).fill(0);
    let active = 0;
    let paused = false;

    function pickLane() {
      const now = performance.now();
      for (let i = 0; i < laneCount; i++) {
        if (laneBusyUntil[i] <= now) return i;
      }
      return -1;
    }

    function buildElement(message) {
      const el = document.createElement('div');
      el.className = 'danmaku';
      el.style.fontSize = `${fontSize}px`;

      if (showAvatar && message.author.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'avatar';
        img.src = message.author.avatarUrl;
        el.appendChild(img);
      }
      if (showAuthor) {
        const name = document.createElement('span');
        name.className = 'author';
        name.textContent = message.author.name;
        el.appendChild(name);
      }
      for (const seg of message.segments) {
        if (seg.type === 'emoji') {
          const img = document.createElement('img');
          img.className = 'emoji';
          img.src = seg.url;
          img.alt = seg.name;
          el.appendChild(img);
        } else {
          el.appendChild(document.createTextNode(seg.value));
        }
      }
      return el;
    }

    return {
      setPaused(v) {
        paused = v;
      },
      render(message) {
        if (paused) return;
        if (active >= maxConcurrent) return; // 過多時はドロップ
        const lane = pickLane();
        if (lane === -1) return;

        const el = buildElement(message);
        el.style.top = `${lane * laneHeight}px`;
        el.style.transform = `translateX(${window.innerWidth}px)`;
        stage.appendChild(el);
        active++;

        const width = el.offsetWidth; // レイアウト確定
        const distance = window.innerWidth + width;
        const durationMs = (distance / speed) * 1000;
        // このレーンが再利用可能になるまでの時間（要素が完全に画面外に出る猶予）
        laneBusyUntil[lane] = performance.now() + (width / speed) * 1000 + 200;

        el.style.transition = `transform ${durationMs}ms linear`;
        requestAnimationFrame(() => {
          el.style.transform = `translateX(${-width}px)`;
        });

        const cleanup = () => {
          el.remove();
          active--;
        };
        el.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, durationMs + 500); // 保険
      },
    };
  },
};

registerRenderer(scrollRenderer);
export default scrollRenderer;
```

- [ ] **Step 3: 構文チェック**

Run: `node --check src/overlay/renderer/scroll-renderer.js`
Expected: 出力なし。

- [ ] **Step 4: Commit**

```bash
git add src/overlay/renderer/scroll-renderer.js src/overlay/renderer/styles.css
git commit -m "feat: 右→左スクロール弾幕レンダラとスタイルを追加"
```

---

## Task 12: renderer 配線 `renderer.js`（WS受信→描画）

**Files:**
- Create: `src/overlay/renderer/renderer.js`

- [ ] **Step 1: `src/overlay/renderer/renderer.js` を作成**

WS に接続し、受信メッセージを scroll レンダラへ渡す。切断時は指数バックオフで再接続。Tray からの toggle を反映。

```js
import { getRenderer } from './danmaku.js';
import './scroll-renderer.js'; // 登録の副作用

const cfg = window.hanabi;
const stage = document.getElementById('stage');

const renderer = getRenderer('scroll').create(stage, {
  fontSize: cfg.fontSize,
  speed: cfg.speed,
  maxConcurrent: cfg.maxConcurrent,
  showAuthor: cfg.showAuthor,
  showAvatar: cfg.showAvatar,
});

cfg.onToggle((enabled) => renderer.setPaused(!enabled));

let backoff = 500;
function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${cfg.wsPort}`);

  ws.addEventListener('open', () => {
    backoff = 500;
    console.log('[overlay] WS 接続');
  });
  ws.addEventListener('message', (ev) => {
    try {
      renderer.render(JSON.parse(ev.data));
    } catch (e) {
      console.error('[overlay] メッセージ解釈失敗', e);
    }
  });
  ws.addEventListener('close', () => {
    console.warn(`[overlay] WS 切断。${backoff}ms 後に再接続`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 10000);
  });
  ws.addEventListener('error', () => ws.close());
}
connect();
```

- [ ] **Step 2: 構文チェック**

Run: `node --check src/overlay/renderer/renderer.js`
Expected: 出力なし。

- [ ] **Step 3: Commit**

```bash
git add src/overlay/renderer/renderer.js
git commit -m "feat: WS受信から弾幕描画への配線を追加"
```

---

## Task 13: エンドツーエンド手動確認

**Files:** （なし）

- [ ] **Step 1: 受信部を起動**

ターミナル1: `npm run receiver`
Expected: Discord 接続完了と WS listening が表示される。

- [ ] **Step 2: 表示部を起動**

ターミナル2: `npm run overlay`
Expected: 透明オーバーレイが起動し、コンソールに `[overlay] WS 接続` が出る。

- [ ] **Step 3: 弾幕を確認**

対象 Discord チャンネルにメッセージを投稿する。
Expected: 投稿が画面右から左へ流れる。カスタム絵文字は画像で表示。送信者名は `SHOW_AUTHOR` 設定に従う。背後のアプリはクリックできる（クリックスルー）。

- [ ] **Step 4: Tray トグルを確認**

メニューバー `🎆` →「弾幕を停止」。
Expected: 以降の新規メッセージが流れなくなる。「弾幕を再開」で再び流れる。

- [ ] **Step 5: 再接続を確認**

受信部（ターミナル1）を Ctrl-C で止め、数秒後に再度 `npm run receiver`。
Expected: 表示部コンソールに再接続ログが出て、投稿すると再び弾幕が流れる。

---

## Task 14: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md` を作成**

````markdown
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

2つのターミナルで:

```bash
npm run receiver   # Discord 受信 + WS ブロードキャスト
npm run overlay    # 透明オーバーレイ表示
```

メニューバーの 🎆 から弾幕の停止/再開・終了ができる。

## 設定（.env）

| 変数 | 意味 |
|------|------|
| `WS_PORT` | 受信部と表示部をつなぐポート |
| `SHOW_AUTHOR` | 送信者名の表示 |
| `SHOW_AVATAR` | 送信者アイコンの表示 |
| `FONT_SIZE` | 弾幕フォントサイズ(px) |
| `DANMAKU_SPEED` | スクロール速度(px/秒) |
| `MAX_CONCURRENT` | 同時表示の最大数（超過分はドロップ） |

## 設計

- 設計書: `docs/superpowers/specs/2026-08-26-hanabi-danmaku-overlay-design.md`
- 意思決定: `adr/`
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: セットアップ手順の README を追加"
```

---

## Self-Review メモ

- **Spec coverage**: 受信(Task 7,8)/formatter・URL短縮・絵文字(Task 3-5)/bridge(Task 6)/透明クリックスルー窓・Tray(Task 9)/差し替え可能レンダラ(Task 10,11)/正規化スキーマ(Task 5,6)/設定(Task 2)/再接続(Task 12)/テスト(Task 3-6)/README・Intent手順(Task 14) をカバー。
- **正規化スキーマの一貫性**: `{ id, author:{name,avatarUrl}, text, segments:[{type,value}|{type,url,name}], timestamp }` を Task 5・6・11 で一致させた。
- **メソッド名の一貫性**: レンダラは `create()` → `{ render(), setPaused() }`、レジストリは `registerRenderer()/getRenderer()` で Task 10-12 一致。
- **スコープ外**（設計 §10）: 他バリエーション・Swift版・画像添付・GUI設定・複数チャンネルは本計画に含めない。
