// @vitest-environment node
/**
 * tests/desktop/icon.test.ts
 * --------------------------------------------------------------------------
 * One avatar, four places.
 *
 * The owner: `把我们枪火柔情的图标，打开游戏顶端的小图标，导航栏的图标，托盘的图标都用这个`
 * - the browser tab, the window/taskbar, the exe file itself and the tray.
 *
 * The source of truth is `build/icon.ico` (his avatar). The browser icons are re-derived from
 * it, and the exe gets it stamped into its PE resource at pack time.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const exists = (...parts: string[]) => existsSync(join(ROOT, ...parts));

describe('the artwork', () => {
    it('ships as build/icons/icon.ico for packaging', () => {
        expect(exists('build', 'icons', 'icon.ico')).toBe(true);
        // A real .ico, not a renamed png: the PE resource writer needs the container.
        const bytes = readFileSync(join(ROOT, 'build', 'icons', 'icon.ico'));
        expect(bytes[0]).toBe(0);
        expect(bytes[1]).toBe(0);
        expect(bytes[2]).toBe(1);
        expect(bytes[3]).toBe(0);
    });

    it('is what the browser tab uses', () => {
        expect(exists('public', 'icons', 'favicon.ico')).toBe(true);
        // Every declared size must exist, or the tab falls back to a blank page icon.
        for (const name of [
            'favicon-16x16.png',
            'favicon-32x32.png',
            'favicon-64x64.png',
            'apple-touch-icon.png',
            'icon-192.png',
            'icon-512.png',
        ]) {
            expect(exists('public', 'icons', name), name).toBe(true);
            expect(statSync(join(ROOT, 'public', 'icons', name)).size).toBeGreaterThan(0);
        }
    });

    it('is wired into index.html', () => {
        const html = read('index.html');
        expect(html).toContain('href="/icons/favicon.ico"');
        expect(html).toContain('href="/icons/icon-192.png"');
        expect(html).toContain('href="/icons/apple-touch-icon.png"');
    });
});

describe('the desktop shell', () => {
    const main = () => read('electron', 'main.cjs');

    it('draws the window and the taskbar button with it', () => {
        expect(main()).toMatch(/icon: fs\.existsSync\(ICON_ICO\) \? ICON_ICO : undefined/);
        expect(main()).toContain("const ICON_ICO = path.join(DIST, 'icons', 'favicon.ico')");
        // Windows groups the taskbar button by AppUserModelId; without it the button says
        // "electron".
        expect(main()).toContain('setAppUserModelId');
    });

    it('puts it in the tray with a way back to the window', () => {
        expect(main()).toMatch(/new Tray\(icon\)/);
        expect(main()).toContain('显示窗口');
        expect(main()).toMatch(/tray\?\.destroy\(\)/);
    });
});

describe('the packaging script', () => {
    it('stamps the exe itself, not just the window', () => {
        const script = read('scripts', 'pack-win.mjs');
        expect(script).toContain('replaceIconsForResource');
        expect(script).toContain("join(ROOT, 'build', 'icons', 'icon.ico')");
    });
});