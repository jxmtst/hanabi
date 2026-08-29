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
process.env.HANABI_AVATAR_SCALE = String(config.avatarScale);
process.env.HANABI_RENDERER = String(config.renderer);

let win;
let tray;
let enabled = true;
let currentRenderer = config.renderer;
let currentDisplayIndex = 0;
let currentAvatarScale = config.avatarScale;
let avatarShown = config.showAvatar;

const RENDERERS = [
  { id: 'scroll', label: 'スクロール' },
  { id: 'firework', label: '花火' },
];

const AVATAR_SCALES = [
  { value: 0.7, label: '小' },
  { value: 1.3, label: '中' },
  { value: 1.8, label: '大' },
  { value: 2.5, label: '特大' },
];

// config.displayIndex を有効範囲にクランプして初期表示ディスプレイを決める
function resolveInitialDisplayIndex() {
  const displays = screen.getAllDisplays();
  if (config.displayIndex >= 0 && config.displayIndex < displays.length) {
    return config.displayIndex;
  }
  console.warn(
    `[overlay] DISPLAY_INDEX=${config.displayIndex} は無効（接続数 ${displays.length}）。主ディスプレイを使用`,
  );
  const primaryId = screen.getPrimaryDisplay().id;
  const idx = displays.findIndex((d) => d.id === primaryId);
  return idx >= 0 ? idx : 0;
}

// 指定ディスプレイへウィンドウを移動しフルスクリーンに合わせる
function moveToDisplay(index) {
  const displays = screen.getAllDisplays();
  const target = displays[index];
  if (!win || !target) return;
  currentDisplayIndex = index;
  win.setBounds(target.bounds);
}

function createWindow() {
  currentDisplayIndex = resolveInitialDisplayIndex();
  const { bounds } = screen.getAllDisplays()[currentDisplayIndex];
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

function buildDisplayMenu() {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  return displays.map((d, i) => {
    const primary = d.id === primaryId ? ' (主)' : '';
    return {
      label: `${i + 1}: ${d.size.width}×${d.size.height}${primary}`,
      type: 'radio',
      checked: currentDisplayIndex === i,
      click: () => {
        moveToDisplay(i);
        rebuildMenu();
      },
    };
  });
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
    {
      label: '表示方式',
      submenu: RENDERERS.map((r) => ({
        label: r.label,
        type: 'radio',
        checked: currentRenderer === r.id,
        click: () => {
          currentRenderer = r.id;
          win?.webContents.send('set-renderer', r.id);
          rebuildMenu();
        },
      })),
    },
    {
      label: '表示画面',
      submenu: buildDisplayMenu(),
    },
    {
      label: 'アイコン',
      submenu: [
        {
          label: 'なし',
          type: 'radio',
          checked: !avatarShown,
          click: () => {
            avatarShown = false;
            win?.webContents.send('set-avatar', { show: false });
            rebuildMenu();
          },
        },
        ...AVATAR_SCALES.map((s) => ({
          label: s.label,
          type: 'radio',
          checked: avatarShown && currentAvatarScale === s.value,
          click: () => {
            avatarShown = true;
            currentAvatarScale = s.value;
            win?.webContents.send('set-avatar', { show: true, scale: s.value });
            rebuildMenu();
          },
        })),
      ],
    },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // モニタの抜き差し・解像度変更でメニューの一覧を最新化する
  const refresh = () => {
    const displays = screen.getAllDisplays();
    if (currentDisplayIndex >= displays.length) moveToDisplay(0);
    rebuildMenu();
  };
  screen.on('display-added', refresh);
  screen.on('display-removed', refresh);
  screen.on('display-metrics-changed', refresh);
});

app.on('window-all-closed', () => app.quit());
