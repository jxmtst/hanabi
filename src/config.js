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
  displayIndex: num(process.env.DISPLAY_INDEX, 0),
  renderer: process.env.RENDERER ?? 'scroll',
  showAuthor: bool(process.env.SHOW_AUTHOR, false),
  showAvatar: bool(process.env.SHOW_AVATAR, false),
  avatarScale: num(process.env.AVATAR_SCALE, 1.3),
  emojiScale: num(process.env.EMOJI_SCALE, 1.5),
  fontSize: num(process.env.FONT_SIZE, 28),
  danmakuSpeed: num(process.env.DANMAKU_SPEED, 500),
  maxConcurrent: num(process.env.MAX_CONCURRENT, 40),
};

// 受信部でのみ必須の値を検証する（表示部では呼ばない）
export function assertReceiverConfig() {
  if (!config.botToken) throw new Error('DISCORD_BOT_TOKEN が未設定です (.env を確認)');
  if (!config.channelId) throw new Error('CHANNEL_ID が未設定です (.env を確認)');
}
