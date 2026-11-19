/**
 * tests/lib/hud/fit-scale.test.ts
 * --------------------------------------------------------------------------
 * 赞赏面板的等比缩小。
 *
 * 主人 2026-11-16：`手机上最后的赞赏页面太大了，需要等比缩小`。
 * 数字取自真机：面板按 67.5rem 画，约 1080 宽，内容高约 700；手机横向可用高度只有 320～380。
 */

import { describe, expect, it } from 'vitest';

import { fitScale } from '@/lib/hud/fit-scale';

describe('fitScale', () => {
    it('leaves a panel alone when it already fits', () => {
        // 桌面：1080×700 的面板放进 1920×1080 的窗口。
        expect(fitScale(1080, 700, 1920, 1080)).toBe(1);
    });

    it('shrinks by height when the phone is too short', () => {
        // 手机横向：可用 800×360，面板 1080×700 → 高度不够，按高度缩。
        const scale = fitScale(1080, 700, 800, 360);
        expect(scale).toBeCloseTo(336 / 700, 5);
        expect(scale).toBeLessThan(1);
    });

    it('shrinks by width when the phone is too narrow', () => {
        const scale = fitScale(1080, 700, 640, 2000);
        expect(scale).toBeCloseTo(616 / 1080, 5);
    });

    it('never enlarges past 1', () => {
        expect(fitScale(200, 100, 4000, 4000)).toBe(1);
    });

    it('returns 1 before the panel has been laid out', () => {
        // 首帧 offsetWidth 还是 0 的时候不要缩成一个点。
        expect(fitScale(0, 0, 800, 360)).toBe(1);
        expect(fitScale(1080, 700, 0, 0)).toBe(1);
    });
});