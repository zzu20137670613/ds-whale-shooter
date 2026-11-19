/**
 * tests/lib/ui/fullscreen.test.ts
 * --------------------------------------------------------------------------
 * The 全屏 chip between the aim switch and the source link.
 *
 * The owner: `在游戏里【键盘操作】按钮与git图标之间加一个按钮，【全屏】，点击后变为【窗口】，
 * 控制游戏是否全屏`.
 *
 * The click behavior and the label are pure functions, so they are tested directly; the chip
 * itself only reads the document and calls the API.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isFullscreenNow, nextFullscreenAction } from '@/lib/ui/fullscreen';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('what a click does', () => {
    it('goes fullscreen while windowed', () => {
        expect(nextFullscreenAction(false)).toBe('enter');
    });

    it('comes back while fullscreen', () => {
        expect(nextFullscreenAction(true)).toBe('exit');
    });
});

describe('what the chip says', () => {
    const chip = () => read('src', 'components', 'hud', 'fullscreen-toggle.tsx');

    it('names the action, not the state', () => {
        // 全屏 while windowed, 窗口 while fullscreen.
        expect(chip()).toContain("t('hud.windowed')");
        expect(chip()).toContain("t('hud.fullscreen')");
        expect(chip()).toMatch(/fullscreen \? t\('hud\.windowed'\) : t\('hud\.fullscreen'\)/);
    });

    it('has both words in the catalogues', () => {
        expect(read('src', 'locales', 'zh-CN.ts')).toMatch(/fullscreen: '全屏'/);
        expect(read('src', 'locales', 'zh-CN.ts')).toMatch(/windowed: '窗口'/);
        expect(read('src', 'locales', 'en.ts')).toMatch(/fullscreen: 'Fullscreen'/);
    });
});

describe('reading the document', () => {
    it('is windowed when nothing is fullscreen', () => {
        expect(isFullscreenNow({ fullscreenElement: null })).toBe(false);
    });

    it('is fullscreen when an element is', () => {
        expect(isFullscreenNow({ fullscreenElement: {} })).toBe(true);
    });

    it('falls back to the prefixed property when the standard one is absent', () => {
        expect(isFullscreenNow({ webkitFullscreenElement: {} })).toBe(true);
        expect(isFullscreenNow({ webkitFullscreenElement: null })).toBe(false);
    });
});

describe('the chip in the corner row', () => {
    const overlay = () => read('src', 'components', 'hud', 'settings-overlay.tsx');

    it('sits between the aim switch and the source link', () => {
        const source = overlay();
        const aim = source.indexOf('<InputSchemeSwitch inline />');
        const chip = source.indexOf('<FullscreenToggle />');
        // The link's URL is chosen per build now (`repoUrl()`), so the assertion looks at the
        // anchor's attribute rather than the old constant name.
        const repo = source.indexOf('href={repoUrl()}');
        expect(aim).toBeGreaterThan(-1);
        expect(chip).toBeGreaterThan(aim);
        expect(repo).toBeGreaterThan(chip);
    });

    it('follows Esc and the F11 shortcut, not just its own click', () => {
        // The state is read back from `document` on every `fullscreenchange`, so leaving
        // fullscreen any other way still updates the label.
        const component = read('src', 'components', 'hud', 'fullscreen-toggle.tsx');
        expect(component).toContain("'fullscreenchange'");
        expect(component).toContain('isFullscreenNow(document)');
    });
});