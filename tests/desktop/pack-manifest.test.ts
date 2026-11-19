// @vitest-environment node
/**
 * tests/desktop/pack-manifest.test.ts
 * --------------------------------------------------------------------------
 * The three packaging details that each cost a broken exe.
 *
 * 1. `resources/app/package.json` must have NO BOM. PowerShell's
 *    `Set-Content -Encoding utf8` writes one, and Electron then refuses to start: no
 *    window, no error, exit code 0x80000003. That was the "双击没反应" build.
 * 2. The app must be named after the game, not the repo.
 * 3. The loopback port must be pinned. IndexedDB and localStorage are per-ORIGIN, and the
 *    origin includes the port - a random port each launch means "my save is gone".
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the packaging script', () => {
    const script = () => read('scripts', 'pack-win.mjs');

    it('writes the manifest as UTF-8 without a BOM', () => {
        expect(script()).toContain('JSON.stringify(manifest, null, 2)');
        // `writeFileSync(path, text, { encoding: 'utf8' })` emits no BOM, and the script
        // never prepends one. (The comment above the call mentions the old mistake on
        // purpose, so the assertion looks for an actual BOM character, not the word.)
        expect(script()).toContain("encoding: 'utf8'");
        expect(script()).not.toContain('\uFEFF');
    });

    it('names the build after the game', () => {
        // The galgame already ships `深海回响.exe` and owns `%APPDATA%\深海回响`, so this
        // build must carry the full title or the two games collide.
        expect(script()).toContain("const APP_NAME = '深海回响 · 枪火柔情'");
        expect(script()).toContain("const ARTIFACT = '深海回响 · 枪火柔情'");
        expect(script()).toContain("'深海回响 · 枪火柔情'");
    });

    it('removes the stock app so the shell is what launches', () => {
        expect(script()).toContain("default_app.asar");
    });
});

describe('the desktop shell', () => {
    const main = () => read('electron', 'main.cjs');

    it('pins the port and remembers it', () => {
        expect(main()).toContain('preferred-port.json');
        expect(main()).toMatch(/DEFAULT_PORT = \d{4,5}/);
        expect(main()).toMatch(/rememberPort\(port\)/);
    });

    it('falls back to a free port instead of dying when the pinned one is taken', () => {
        expect(main()).toMatch(/attempt\(0, true\)/);
    });

    it('titles the window with the game name', () => {
        expect(main()).toContain("const GAME_TITLE = '深海回响 · 枪火柔情'");
    });
});