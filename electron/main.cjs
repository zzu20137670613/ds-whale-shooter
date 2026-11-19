/**
 * electron/main.cjs
 * --------------------------------------------------------------------------
 * The desktop shell for the packaged build.
 *
 * Two things it gets right, both learned the hard way:
 *
 * 1. It serves `dist/` over loopback HTTP instead of `loadFile`-ing it. The game fetches
 *    its data with absolute paths (`/data/levels/...`, `/assets/...`), which resolve to
 *    the filesystem root under `file://` - a plain `loadFile` build boots to a blank
 *    screen with a wall of 404s.
 *
 * 2. It pins the port. The browser storage the game uses (IndexedDB, localStorage) is
 *    isolated per ORIGIN, and origin includes the port - so a random port every launch
 *    reads as "my save is gone". The chosen port is remembered in
 *    `<userData>/preferred-port.json` and reused.
 */

const { app, BrowserWindow, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { createStaticServer } = require('./static-server.cjs');

/** Where the built site lives, both in the repo and inside the packaged app. */
const DIST = path.join(__dirname, '..', 'dist');

/** Title bar. The store name, not the repo name. */
const GAME_TITLE = '深海回响 · 枪火柔情';

/**
 * The avatar icon, used for the window, the taskbar and the tray.
 *
 * It ships inside the app (`dist/icons/favicon.ico`, copied from `public/icons/`) so the same file the
 * browser tab uses is the one Windows draws - one source, no drift.
 */
const ICON_ICO = path.join(DIST, 'icons', 'favicon.ico');
const ICON_PNG = path.join(DIST, 'icons', 'icon-192.png');

/** Keep one tray reference alive; a local goes out of scope and the icon disappears. */
let tray = null;

/** First choice for the pinned port; the remembered one wins over it. */
const DEFAULT_PORT = 45119;

function preferredPortFile() {
    return path.join(app.getPath('userData'), 'preferred-port.json');
}

function readPreferredPort() {
    try {
        const raw = JSON.parse(fs.readFileSync(preferredPortFile(), 'utf8'));
        const port = Number(raw?.port);
        if (Number.isInteger(port) && port > 1023 && port < 65536) return port;
    } catch {
        // First launch, or a corrupt file: fall through to the default.
    }
    return DEFAULT_PORT;
}

function rememberPort(port) {
    try {
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.writeFileSync(preferredPortFile(), JSON.stringify({ port }), 'utf8');
    } catch (error) {
        // Not fatal: a new origin only costs the player their browser-side save.
        console.warn('[desktop] could not remember the port', error);
    }
}

/**
 * Listen on the remembered port, falling back to any free port.
 *
 * The fallback is what would silently change the origin, so it writes the new port back -
 * the NEXT launch then lands on the same origin again.
 */
function listenPinned(server, wanted) {
    return new Promise((resolve) => {
        const attempt = (port, isLast) => {
            const onError = () => {
                server.removeListener('listening', onListening);
                if (isLast) resolve(null);
                else attempt(0, true);
            };
            const onListening = () => {
                server.removeListener('error', onError);
                resolve(server.address().port);
            };
            server.once('error', onError);
            server.once('listening', onListening);
            server.listen(port, '127.0.0.1');
        };
        attempt(wanted, false);
    });
}

function createWindow(port) {
    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        backgroundColor: '#0c0a09',
        title: GAME_TITLE,
        icon: fs.existsSync(ICON_ICO) ? ICON_ICO : undefined,
        // The game is laid out for landscape; a menu bar only eats the top of it.
        autoHideMenuBar: true,
        webPreferences: {
            // Nothing in the renderer needs node: it is the same web build.
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    Menu.setApplicationMenu(null);
    win.loadURL(`http://127.0.0.1:${port}/`);

    // F11 fullscreen and F12 devtools, so a bug report can still include a console.
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
            event.preventDefault();
        }
        if (input.key === 'F12') {
            win.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

    return win;
}

app.whenReady().then(async () => {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
        // A packaged app that cannot find its own build is a packaging bug, not a game bug.
        dialog.showErrorBox('缺少构建产物', `找不到 ${path.join(DIST, 'index.html')}`);
        app.quit();
        return;
    }

    const server = createStaticServer(DIST);
    const port = await listenPinned(server, readPreferredPort());
    if (!port) {
        dialog.showErrorBox('无法启动', '本机没有可用端口，游戏无法启动。');
        app.quit();
        return;
    }
    rememberPort(port);

    // Without this Windows groups the taskbar button under "electron" instead of the game.
    app.setAppUserModelId('com.zzu.shenhaihuixiang');

    const win = createWindow(port);
    createTray(win);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
});

/**
 * A tray icon, so a game that is minimised can be brought back without hunting the taskbar.
 *
 * Closing the window still quits: a background process the player cannot see is worse than
 * an app that has to be started again.
 */
function createTray(win) {
    if (!fs.existsSync(ICON_ICO)) return null;
    const icon = nativeImage.createFromPath(ICON_ICO);
    if (icon.isEmpty()) return null;

    tray = new Tray(icon);
    tray.setToolTip(GAME_TITLE);
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: '显示窗口',
                click: () => {
                    win.show();
                    win.focus();
                },
            },
            { type: 'separator' },
            { label: '退出', click: () => app.quit() },
        ]),
    );
    tray.on('click', () => {
        if (win.isVisible() && !win.isMinimized()) win.minimize();
        else {
            win.show();
            win.focus();
        }
    });
    return tray;
}

app.on('window-all-closed', () => {
    app.quit();
});

app.on('before-quit', () => {
    tray?.destroy();
    tray = null;
});