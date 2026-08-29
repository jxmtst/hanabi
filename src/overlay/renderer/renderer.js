import { getRenderer } from './danmaku.js';
import './scroll-renderer.js'; // 登録の副作用
import './firework-renderer.js'; // 登録の副作用

const cfg = window.hanabi;
const stage = document.getElementById('stage');

const options = {
  fontSize: cfg.fontSize,
  speed: cfg.speed,
  maxConcurrent: cfg.maxConcurrent,
  showAuthor: cfg.showAuthor,
  showAvatar: cfg.showAvatar,
  avatarScale: cfg.avatarScale,
  emojiScale: cfg.emojiScale,
};

let paused = false;
let currentName = cfg.renderer;
let renderer = null;

// 現在の設定でレンダラを（再）生成する。文字サイズ等の幾何情報も反映される。
// 既に表示中の弾幕は各自のタイマーで自然に消える。
function build() {
  renderer = getRenderer(currentName).create(stage, options);
  renderer.setPaused(paused);
}
build();

cfg.onToggle((enabled) => {
  paused = !enabled;
  renderer.setPaused(paused);
});
cfg.onSetRenderer((name) => {
  currentName = name;
  build();
  console.log(`[overlay] レンダラ切替: ${name}`);
});
// 表示に関わる設定変更はすべてここで受け、options を更新して作り直す。
cfg.onSetOptions((patch) => {
  Object.assign(options, patch);
  build();
  console.log('[overlay] 設定変更:', patch);
});

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
