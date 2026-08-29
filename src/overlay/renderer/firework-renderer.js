import { registerRenderer } from './danmaku.js';

const DURATION_MS = 1800;
const SPARK_COUNT = 12;

const fireworkRenderer = {
  name: 'firework',
  create(stage, options) {
    const { fontSize, maxConcurrent, showAuthor } = options;
    let active = 0;
    let paused = false;

    function buildText(message) {
      const el = document.createElement('div');
      el.className = 'firework-text';
      el.style.fontSize = `${fontSize}px`;

      if (options.showAvatar && message.author.avatarUrl) {
        const img = document.createElement('img');
        img.className = 'avatar';
        img.style.height = `${options.avatarScale}em`;
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
          img.style.height = `${options.emojiScale}em`;
          img.src = seg.url;
          img.alt = seg.name;
          el.appendChild(img);
        } else {
          el.appendChild(document.createTextNode(seg.value));
        }
      }
      return el;
    }

    function spawnSparks(burst, color) {
      for (let i = 0; i < SPARK_COUNT; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        spark.style.background = color;
        // 上半球方向（-30°〜210°の内、上向き中心）へ放射
        const angle = Math.PI * (0.15 + Math.random() * 0.7); // 上向き扇状
        const dist = 60 + Math.random() * 120;
        const dx = Math.cos(angle) * dist * (Math.random() < 0.5 ? -1 : 1);
        const dy = -Math.sin(angle) * dist;
        spark.style.setProperty('--dx', `${dx}px`);
        spark.style.setProperty('--dy', `${dy}px`);
        burst.appendChild(spark);
      }
    }

    return {
      setPaused(v) {
        paused = v;
      },
      render(message) {
        if (paused) return;
        if (active >= maxConcurrent) return; // 過多時はドロップ

        // ランダムな打ち上げ点（縦は下寄り 40〜85%、上に広がる余地を残す）
        const x = Math.random() * window.innerWidth;
        const y = window.innerHeight * (0.4 + Math.random() * 0.45);
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 90%, 65%)`;

        const burst = document.createElement('div');
        burst.className = 'firework';
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;

        const text = buildText(message);
        text.style.color = color;
        burst.appendChild(text);
        spawnSparks(burst, color);

        stage.appendChild(burst);
        active++;

        const cleanup = () => {
          burst.remove();
          active--;
        };
        // アニメーション終了で消す（保険つき）
        text.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, DURATION_MS + 400);
      },
    };
  },
};

registerRenderer(fireworkRenderer);
export default fireworkRenderer;
