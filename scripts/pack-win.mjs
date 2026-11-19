/**
 * scripts/pack-win.mjs
 * --------------------------------------------------------------------------
 * Assembles the Windows build: Electron runtime + `dist/` + the desktop shell, then zips it.
 *
 * Why not electron-builder: its `app-builder-bin` dependency cannot be downloaded here (the
 * mirror that works for `electron` does not serve it), so the packaging is done by hand. The
 * result is the same layout electron-builder produces for a portable app:
 *
 *   <root>/<App>.exe                     the Electron binary, renamed
 *   <root>/resources/app/package.json    points at electron/main.cjs
 *   <root>/resources/app/dist/           the built site
 *
 * Two details that cost real debugging time, both handled here:
 *   - `package.json` is written WITHOUT a BOM. PowerShell's `Set-Content -Encoding utf8`
 *     writes one, and Electron then refuses to start with no window and no error.
 *   - The app name / product name come from the game's own title, not the repo name, so the
 *     `userData` folder (and therefore the save) sits under the name players know.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const RELEASE = join(ROOT, 'release');

/** The name players see: window title, userData folder, exe file name. */
const GAME_TITLE = '深海回响 · 枪火柔情';
// Same string for the exe, the release folder and `productName`: the galgame already owns
// `深海回响` (its userData is `%APPDATA%\深海回响`), so a bare `深海回响.exe` would both
// collide on the desktop and share a data directory with a different game.
const APP_NAME = '深海回响 · 枪火柔情';
const ARTIFACT = '深海回响 · 枪火柔情';

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const OUT = join(RELEASE, APP_NAME);

function step(message) {
    process.stdout.write(`• ${message}\n`);
}

step('building the site');
execFileSync(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite/config.prod.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
});

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
    throw new Error('dist/index.html missing after the build');
}

const electronDist = join(ROOT, 'node_modules', 'electron', 'dist');
if (!existsSync(join(electronDist, 'electron.exe'))) {
    throw new Error('electron runtime missing - run `pnpm install` first');
}

step('copying the electron runtime');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(electronDist, OUT, { recursive: true });

// The stock app that ships with the runtime would otherwise be launched.
rmSync(join(OUT, 'resources', 'default_app.asar'), { force: true });
renameSync(join(OUT, 'electron.exe'), join(OUT, `${ARTIFACT}.exe`));

step('wiring resources/app');
const appDir = join(OUT, 'resources', 'app');
mkdirSync(join(appDir, 'electron'), { recursive: true });
cpSync(join(ROOT, 'dist'), join(appDir, 'dist'), { recursive: true });
cpSync(join(ROOT, 'electron', 'main.cjs'), join(appDir, 'electron', 'main.cjs'));
cpSync(join(ROOT, 'electron', 'static-server.cjs'), join(appDir, 'electron', 'static-server.cjs'));

// Written with an explicit encoding and NO BOM - this exact byte is what broke v1.
const manifest = {
    name: 'shenhai-huixiang',
    productName: APP_NAME,
    version,
    description: GAME_TITLE,
    main: 'electron/main.cjs',
};
writeFileSync(join(appDir, 'package.json'), JSON.stringify(manifest, null, 2), {
    encoding: 'utf8',
});

step('stamping the exe icon');
const exePath = join(OUT, `${ARTIFACT}.exe`);
const iconPath = join(ROOT, 'build', 'icons', 'icon.ico');
if (existsSync(iconPath)) {
    // The Electron binary carries Electron's own icon; Windows reads it from the PE resource,
    // so the window and taskbar would show the default logo without this rewrite.
    const require_ = createRequire(import.meta.url);
    const ResEdit = require_('resedit');
    const data = ResEdit.NtExecutable.from(readFileSync(exePath), { ignoreCert: true });
    const res = ResEdit.NtExecutableResource.from(data);
    const iconFile = ResEdit.Data.IconFile.from(readFileSync(iconPath));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map((item) => item.data),
    );
    res.outputResource(data);
    writeFileSync(exePath, Buffer.from(data.generate()));
    process.stdout.write('• exe icon replaced\n');
} else {
    process.stdout.write('  [warn] build/icons/icon.ico 不存在，exe 会保留 Electron 默认图标\n');
}

step(`packaged ${ARTIFACT}.exe (v${version})`);
process.stdout.write(`\n打开这个文件即可运行：\n${join(OUT, `${ARTIFACT}.exe`)}\n`);