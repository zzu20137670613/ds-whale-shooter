/**
 * tests/lib/hud/clock.test.ts
 * --------------------------------------------------------------------------
 * `MM:SS` 只写一次：顶部关卡牌和存档格的小牌子共用。
 *
 * 主人 2026-11-16 决定存档缩略图不再截图、改用「地图名小牌子」，所以这个格式变成了
 * 两处共用的东西 —— 两处显示成不一样的数字会很怪。
 */

import { describe, expect, it } from 'vitest';

import { formatMmSs } from '@/lib/hud/clock';

describe('formatMmSs', () => {
    it('pads both halves', () => {
        expect(formatMmSs(0)).toBe('00:00');
        expect(formatMmSs(5_000)).toBe('00:05');
        expect(formatMmSs(65_000)).toBe('01:05');
        // 63:59 就是主人截图里那块「海边亭台」的计时。
        expect(formatMmSs((63 * 60 + 59) * 1000)).toBe('63:59');
    });

    it('caps the minutes at 99 instead of growing a third digit', () => {
        // 分钟被夹到 99，秒照实走 —— 和原来那块 HUD 牌子的行为一致。
        expect(formatMmSs(100 * 60 * 1000)).toBe('99:00');
        expect(formatMmSs((99 * 60 + 59) * 1000)).toBe('99:59');
        expect(formatMmSs(9_999 * 60 * 1000 + 30_000)).toBe('99:30');
    });

    it('survives junk without printing NaN', () => {
        expect(formatMmSs(-1)).toBe('00:00');
        expect(formatMmSs(Number.NaN)).toBe('00:00');
        expect(formatMmSs(Number.POSITIVE_INFINITY)).toBe('00:00');
    });
});