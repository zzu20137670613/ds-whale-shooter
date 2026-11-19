/**
 * tests/lib/ui/selection.test.ts
 * --------------------------------------------------------------------------
 * Nothing in the game may be drag-selected, because the selection highlight reads as a
 * rendering bug.
 *
 * The owner, after ruling the files out: `游戏里真的有叠加层…我怀疑与选中那种状态一样，比如某种
 * 图片，鼠标左键按下批量选图的那种渲染，看起来非常像`. That is exactly what it was: aiming and
 * advancing the comic both involve mousedown-and-drag, which started a text/image selection,
 * and Chromium painted its blue highlight over the whole comic page. Reproduced by selecting
 * the `<img>` with a range: white bubbles turned blue, black text stayed black, the 跳过
 * button stayed untouched - the screenshot he sent, to the pixel.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('selection is off across the app', () => {
    const css = () => read('src', 'index.css');

    it('opts html and body out', () => {
        expect(css()).toMatch(/html,\s*body\s*\{[^}]*user-select:\s*none/);
    });

    it('keeps it possible to select inside an input', () => {
        // The nickname dialog would be unusable otherwise.
        expect(css()).toMatch(/input,\s*textarea,\s*\[contenteditable='true'\]\s*\{[^}]*user-select:\s*text/);
    });

    it('paints nothing even if a selection is created in code', () => {
        expect(css()).toMatch(/::selection\s*\{[^}]*background:\s*transparent/);
    });
});

describe('the comic reader', () => {
    const overlay = () => read('src', 'components', 'hud', 'comic-overlay.tsx');

    it('is explicitly unselectable, page included', () => {
        expect(overlay()).toMatch(/bg-black select-none/);
        expect(overlay()).toMatch(/object-contain transition-opacity duration-500 select-none/);
    });

    it('still refuses to be dragged as an image', () => {
        expect(overlay()).toContain('draggable={false}');
    });
});