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
