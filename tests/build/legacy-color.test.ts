/**
 * tests/build/legacy-color.test.ts
 * --------------------------------------------------------------------------
 * The HP bar has to be red and the HUD text has to be light on Chromium 91.
 *
 * Tailwind v4 writes colours as `oklch()` and translucent ones as `color-mix(in oklab, …)`.
 * Chromium 91 knows neither, so the declaration is invalid and the browser falls back:
 * `background-color` -> transparent, `color` -> black. That is exactly what the owner saw
 * (`血蓝量没有渲染上`, `字体都变成了黑色`).
 */

import { describe, expect, it } from 'vitest';

import {
    collectVariables,
    formatColor,
    lowerColors,
    oklchToSrgb,
    resolveColorToken,
} from '../../vite/plugins/legacy-color.mjs';

const near = (actual: number, expected: number, tolerance = 2) =>
    Math.abs(actual - expected) <= tolerance;

describe('oklch to sRGB', () => {
    it('converts pure red', () => {
        const [r, g, b] = oklchToSrgb(0.62796, 0.25768, 29.234);
        expect(near(r, 255)).toBe(true);
        expect(near(g, 0, 3)).toBe(true);
        expect(near(b, 0, 3)).toBe(true);
    });

    it('converts white and black', () => {
        expect(oklchToSrgb(1, 0, 0)).toEqual([255, 255, 255]);
        expect(oklchToSrgb(0, 0, 0)).toEqual([0, 0, 0]);
    });

    it('accepts `none` for an achromatic channel', () => {
        // Tailwind writes `oklch(97% 0 none)` for greys; `none` is a legal CSS keyword.
        expect(oklchToSrgb(0.97, 0, 0)).toEqual(oklchToSrgb(0.97, 0, 0));
        const out = lowerColors(':root{--c:oklch(97% 0 none)}');
        expect(out).not.toContain('oklch(');
        expect(out).toMatch(/--c:rgb\(2[3-5]\d/);
    });

    it('converts a Tailwind stone tone to a grey', () => {
        const [r, g, b] = oklchToSrgb(0.97, 0.001, 106.424);
        expect(Math.abs(r - g)).toBeLessThanOrEqual(3);
        expect(Math.abs(g - b)).toBeLessThanOrEqual(3);
        expect(r).toBeGreaterThan(230);
    });
});

describe('resolving colour tokens', () => {
    const variables = new Map([
        ['--color-red-600', 'oklch(57.7% .245 27.325)'],
        ['--color-black', '#000'],
    ]);

    it('reads hex', () => {
        expect(resolveColorToken('#000', variables)).toEqual({ rgb: [0, 0, 0], alpha: 1 });
        expect(resolveColorToken('#fff', variables)).toEqual({ rgb: [255, 255, 255], alpha: 1 });
    });

    it('follows a custom property', () => {
        // red-600 is #e7000b-ish, not pure red: only the red channel should dominate.
        const red = resolveColorToken('var(--color-red-600)', variables);
        expect(red?.rgb[0]).toBeGreaterThan(200);
        expect(red?.rgb[1]).toBeLessThan(40);
        expect(red?.rgb[2]).toBeLessThan(40);
    });

    it('knows rgb() and transparent', () => {
        expect(resolveColorToken('rgb(10 20 30)', variables)).toEqual({
            rgb: [10, 20, 30],
            alpha: 1,
        });
        expect(resolveColorToken('transparent', variables)).toEqual({ rgb: [0, 0, 0], alpha: 0 });
    });

    it('gives up on currentcolor instead of guessing', () => {
        expect(resolveColorToken('currentcolor', variables)).toBeNull();
    });
});

describe('lowering a stylesheet', () => {
    it('turns a theme variable into a paintable colour', () => {
        const css = ':root{--color-red-600:oklch(57.7% .245 27.325)}.bg-red-600{background-color:var(--color-red-600)}';
        const out = lowerColors(css);
        expect(out).not.toContain('oklch(');
        expect(out).toMatch(/--color-red-600:rgb\(/);
    });

    it('evaluates the /opacity shape Tailwind emits', () => {
        const css =
            ':root{--color-black:#000}.bg-black\\/80{background-color:color-mix(in oklab,var(--color-black) 80%,transparent)}';
        const out = lowerColors(css);
        expect(out).toContain('rgba(0, 0, 0, 0.8)');
        expect(out).not.toContain('color-mix');
    });

    it('leaves a mix it cannot resolve alone', () => {
        const css = '.a{background-color:color-mix(in oklab,currentcolor 50%,transparent)}';
        expect(lowerColors(css)).toBe(css);
    });

    it('keeps every other declaration untouched', () => {
        const css = '.a{width:1.25rem;color:oklch(97% .001 106.424);margin:0}';
        const out = lowerColors(css);
        expect(out).toContain('width:1.25rem');
        expect(out).toContain('margin:0');
        expect(out).toMatch(/color:rgb\(2[3-5]\d/);
    });

    it('is stable when run twice', () => {
        const css = '.a{color:oklch(97% .001 106.424);background:color-mix(in oklab,#000 50%,transparent)}';
        const once = lowerColors(css);
        expect(lowerColors(once)).toBe(once);
    });

    it('formats an opaque colour as rgb and a translucent one as rgba', () => {
        expect(formatColor({ rgb: [1, 2, 3], alpha: 1 })).toBe('rgb(1 2 3)');
        expect(formatColor({ rgb: [1, 2, 3], alpha: 0.5 })).toBe('rgba(1, 2, 3, 0.5)');
    });

    it('collects the variables it needs', () => {
        const vars = collectVariables(':root{--a:1;--b:oklch(50% .1 200)}');
        expect(vars.get('--a')).toBe('1');
        expect(vars.get('--b')).toContain('oklch');
    });
});