import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hanabi', {
  wsPort: Number(process.env.HANABI_WS_PORT ?? 8787),
  fontSize: Number(process.env.HANABI_FONT_SIZE ?? 28),
  speed: Number(process.env.HANABI_SPEED ?? 140),
  maxConcurrent: Number(process.env.HANABI_MAX ?? 40),
  showAuthor: process.env.HANABI_SHOW_AUTHOR !== 'false',
  showAvatar: process.env.HANABI_SHOW_AVATAR === 'true',
  avatarScale: Number(process.env.HANABI_AVATAR_SCALE ?? 1.6),
  renderer: process.env.HANABI_RENDERER ?? 'scroll',
  onToggle: (cb) => ipcRenderer.on('danmaku-toggle', (_e, enabled) => cb(enabled)),
  onSetRenderer: (cb) => ipcRenderer.on('set-renderer', (_e, name) => cb(name)),
});
