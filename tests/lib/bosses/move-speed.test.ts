/**
 * tests/lib/bosses/move-speed.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-15：`bossClaude的初始移速+1`。
 *
 * 「初始」= 第一形态（灭世·Claude）。它是**平加**，不是倍率：倍率会把第二形态的 1.5 倍
 * 一起放大，那不是他要的。这条把三件事钉住：第一形态 +1、其他形态不动、平加发生在
 * 倍率之后。
 */

import { describe, expect, it } from 'vitest';

import { BOSS_PHASES } from '@/lib/bosses/phases';

/** 和 `MonsterController.phaseSpeed` 同一条算式。 */
const speedAt = (index: number, base = 5): number => {
    const phase = BOSS_PHASES[index]!;
    return base * phase.moveScale + (phase.moveBonus ?? 0);
};

describe('boss movement speed', () => {
    it('gives the first phase one extra unit', () => {
        // base 5.0 × 1 + 1 = 6.0
        expect(speedAt(0)).toBeCloseTo(6, 5);
        expect(BOSS_PHASES[0]!.moveBonus).toBe(1);
    });

    it('leaves every later phase alone', () => {
        for (let i = 1; i < BOSS_PHASES.length; i++) {
            expect(BOSS_PHASES[i]!.moveBonus ?? 0, `phase ${i + 1}`).toBe(0);
        }
        // 第二形态仍然 1.5 倍：5 × 1.5 = 7.5，没有叠上那 1 点。
        expect(speedAt(1)).toBeCloseTo(7.5, 5);
    });

    it('adds after the multiplier, so the ladder keeps its shape', () => {
        // 第一形态 6.0 仍低于第二形态 7.5 —— 阶梯没被这 1 点打乱。
        expect(speedAt(0)).toBeLessThan(speedAt(1));
    });
});