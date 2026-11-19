/**
 * scripts/pack-installer.mjs
 * --------------------------------------------------------------------------
 * Builds the setup.exe: the "double-click, choose a folder" installer.
 *
 * Two products come out of this repo and they are not the same thing:
 *   - `pnpm pack:win`       → a portable folder (run in place, no install, no uninstaller)
 *   - `pnpm pack:installer` → that folder, wrapped in an NSIS wizard
 *
 * Why NSIS by hand instead of `electron-builder --target nsis`: electron-builder needs
 * `app-builder-bin` at install time and that download does not survive this network (the
 * mirror that serves `electron` does not serve it). NSIS itself is a 2 MB zip with a
 * stand-alone `makensis`, so the wizard is compiled directly.
 *
 * NSIS is looked for in this order: `$NSIS_DIR`, then an unpacked copy inside `.cache`,
 * then any `makensis.exe` on PATH.
 */

import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const RELEASE = join(ROOT, 'release');
const ARTIFACT = '深海回响 · 枪火柔情';
const APP_DIR = join(RELEASE, ARTIFACT);

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const outFile = join(RELEASE, `${ARTIFACT}-安装程序-${version}.exe`);

function step(message) {
    process.stdout.write(`• ${message}\n`);
}

/** Every place an unpacked NSIS might be sitting. */
function makensisCandidates() {
    const out = [];
    if (process.env.NSIS_DIR) out.push(join(process.env.NSIS_DIR, 'makensis.exe'));

    // The zip unpacks to `<cache>/nsis-3.10/nsis-3.10/makensis.exe`, so look two levels deep.
    const caches = [join(ROOT, '.cache'), join(ROOT, '..', '.cache')];
    for (const cache of caches) {
        if (!existsSync(cache)) continue;
        for (const entry of readdirSync(cache)) {
            out.push(join(cache, entry, 'makensis.exe'));
            out.push(join(cache, entry, entry, 'makensis.exe'));
            out.push(join(cache, entry, 'Bin', 'makensis.exe'));
            out.push(join(cache, entry, entry, 'Bin', 'makensis.exe'));
        }
    }
    return out;
}

function findMakensis() {
    for (const candidate of makensisCandidates()) {
        if (existsSync(candidate)) return candidate;
    }
    try {
        execFileSync('makensis', ['/?'], { stdio: 'ignore' });
        return 'makensis';
    } catch {
        // Fall through to the error below.
    }
    throw new Error(
        '找不到 makensis。先跑 `pnpm nsis`（把 NSIS 下到 .cache），或设 NSIS_DIR 指向解压目录。',
    );
}

if (!existsSync(join(APP_DIR, `${ARTIFACT}.exe`))) {
    throw new Error(`先跑 \`pnpm pack:win\`：${APP_DIR} 里没有可打包的运行文件`);
}

const makensis = findMakensis();
step(`compiling with ${makensis}`);

const nsiDir = join(ROOT, 'scripts');
// The script refers to icon.ico next to itself, so run from scripts/ with absolute defines.
const icon = join(ROOT, 'build', 'icons', 'icon.ico');
if (!existsSync(icon)) throw new Error('缺少 build/icons/icon.ico，安装程序没有图标');

mkdirSync(RELEASE, { recursive: true });

// makensis reads a script as ANSI unless it starts with a BOM, and every path here has
// Chinese in it. A generated defines file keeps them out of the command line (the console
// codepage mangles them) and lets both files be plain UTF-8 with BOM.
const definesFile = join(nsiDir, 'installer-defines.nsh');
const defines = [
    `!define VERSION "${version}"`,
    `!define SRCDIR "${APP_DIR}"`,
    `!define OUTFILE "${outFile}"`,
    `!define MUIICON "${icon}"`,
];
writeFileSync(definesFile, `\uFEFF${defines.join('\n')}\n`, 'utf8');

// makensis maps a temp file for the solid-compressed payload and dies with
// `Internal compiler error #12345: error creating mmap` when %TEMP% is somewhere it cannot
// map (this workspace's default TEMP is one). Pointing TMP at a folder we own fixes it, and
// the folder is removed again afterwards.
const nsisTmp = join(ROOT, '.tmp-nsis');
mkdirSync(nsisTmp, { recursive: true });

try {
    execFileSync(makensis, ['/V2', join(nsiDir, 'installer.nsi')], {
        cwd: nsiDir,
        stdio: 'inherit',
        env: { ...process.env, TMP: nsisTmp, TEMP: nsisTmp },
    });
} finally {
    rmSync(nsisTmp, { recursive: true, force: true });
    // Generated per build; leaving it behind would make a stale path look like a real one.
    rmSync(definesFile, { force: true });
}

if (!existsSync(outFile)) throw new Error('makensis 结束但没有产出安装程序');

const mb = Math.round(statSync(outFile).size / (1024 * 1024));
process.stdout.write(`\n安装程序已生成（${mb} MB）：\n${outFile}\n`);