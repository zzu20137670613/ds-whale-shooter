/**
 * tests/game/drops/token-beam.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-14：`现在的光柱，有点"1毛特效了"`，要「传奇」那种 5 毛特效。
 *
 * The beam is a pre-rendered 8x6 sequence, so the things that can silently break are all
 * numbers: a sheet whose size does not match the declared grid, a frame count the anim loops
 * past, a tint that does not come from the level palette. Each is pinned here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    beamTint,
    levelNeedsTokenBeam,
    TOKEN_BEAM_ANIM,
    TOKEN_BEAM_FPS,
    TOKEN_BEAM_FRAME,
    TOKEN_BEAM_FRAME_COUNT,
    TOKEN_BEAM_PATH,
    TOKEN_BEAM_SCALE,
    TOKEN_BEAM_SCALE_X,
    TOKEN_BEAM_SHEET,
} from '@/game/drops/token-beam';
import { TOKEN_PILLAR_PALETTES } from '@/lib/constants';

const ROOT = process.cwd();

/** PNG 的宽高就在 IHDR 里，第 16..24 字节；不必拉一个图像库进测试。 */
function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the token beam sheet', () => {
    it('ships the file the loader asks for', () => {
        const size = pngSize(join(ROOT, 'public', TOKEN_BEAM_PATH));
        expect(size).toEqual({
            width: TOKEN_BEAM_FRAME.width * TOKEN_BEAM_SHEET.cols,
            height: TOKEN_BEAM_FRAME.height * TOKEN_BEAM_SHEET.rows,
        });
    });

    it('has 48 frames in an 8x6 grid', () => {
        expect(TOKEN_BEAM_SHEET).toEqual({ cols: 8, rows: 6 });
        expect(TOKEN_BEAM_FRAME_COUNT).toBe(48);
        expect(TOKEN_BEAM_FRAME).toEqual({ width: 128, height: 288 });
    });

    it('plays at a rate that finishes in about three seconds', () => {
        const loopSeconds = TOKEN_BEAM_FRAME_COUNT / TOKEN_BEAM_FPS;
        expect(loopSeconds).toBeGreaterThan(2);
        expect(loopSeconds).toBeLessThan(4);
    });

    it('scales to roughly twice the old 60x210 rectangle, and half again as wide', () => {
        // 主人 2026-11-14：`3.要`（放大）。旧柱 60 宽 210 高。
        // 主人 2026-11-15：`光柱直径窄了点，扩大一半。高度可以，高度不用调`。
        const drawnWidth = TOKEN_BEAM_FRAME.width * TOKEN_BEAM_SCALE_X;
        const drawnHeight = TOKEN_BEAM_FRAME.height * TOKEN_BEAM_SCALE;
        expect(drawnWidth).toBeGreaterThan(160);
        expect(drawnWidth).toBeLessThan(190);
        expect(drawnHeight).toBeGreaterThan(240);
        expect(drawnHeight).toBeLessThan(280);
    });

    it('is tinted from the level palette, so one sheet serves all three tones', () => {
        expect(beamTint('gold')).toBe(TOKEN_PILLAR_PALETTES.gold.fill);
        expect(beamTint('dark')).toBe(TOKEN_PILLAR_PALETTES.dark.fill);
        expect(beamTint(undefined)).toBe(TOKEN_PILLAR_PALETTES.bright.fill);
        // 三个色调必须互不相同，否则 tint 白做。
        const tones = new Set(['gold', 'dark', 'bright'].map((t) => beamTint(t as never)));
        expect(tones.size).toBe(3);
    });

    it('uses one animation key', () => {
        expect(TOKEN_BEAM_ANIM).toBe('token-beam');
    });
});

describe('loading is on demand', () => {
    it('asks for the sheet when the level can drop a token shield', () => {
        expect(
            levelNeedsTokenBeam([
                { effect: { type: 'instant' } },
                { effect: { type: 'token-shield' } },
            ]),
        ).toBe(true);
    });

    it('asks for the sheet when a drop declares its own beam', () => {
        // 2026-11-17 的 bug：只认 token-shield，于是加冕之冠那关根本没加载这张图，
        // 光柱退化成一根纯色矩形（`为什么没有那些花里胡哨的特效`）。
        expect(
            levelNeedsTokenBeam([
                { effect: { type: 'instant' } },
                { beam: 'bright', effect: { type: 'max-bonus' } },
            ]),
        ).toBe(true);
    });

    it('stays quiet for every other level', () => {
        expect(
            levelNeedsTokenBeam([
                { effect: { type: 'instant' } },
                { effect: { type: 'refill-ammo' } },
            ]),
        ).toBe(false);
        expect(levelNeedsTokenBeam([])).toBe(false);
    });
});
