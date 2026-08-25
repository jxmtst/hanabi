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
      sandbox: false, // ESM preload を有効にするため
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
