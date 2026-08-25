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
