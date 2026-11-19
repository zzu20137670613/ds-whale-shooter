/**
 * tests/lib/drops/token-shield.test.ts
 * --------------------------------------------------------------------------
 * The 词元盾 ladder and the HP→SP damage split.
 *
 * Every expectation below is a restatement of the owner's 2026-11-12 spec:
 * ten percent of the hit per level, moved — never removed — and the shield goes
 * quiet the moment the blue bar cannot pay for the whole share.
 */

import { describe, expect, it } from 'vitest';

import {
    TOKEN_SHIELD_MAX_LEVEL,
    collectTokenShield,
    splitTokenShieldDamage,
    tokenShieldLevels,
    tokenShieldShare,
} from '@/lib/drops/token-shield';

describe('the ladder', () => {
    it('is one tenth per level and caps at half', () => {
        // 主人 2026-11-15：`将词元盾的5级上限改为10级`，并且
        // `前4级效果不变，第5级 45%，第6级 50%，第7级 55%，第8级 60%，第9级 65%，max 70%`。
        expect(TOKEN_SHIELD_MAX_LEVEL).toBe(10);
        expect(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((l) => tokenShieldShare(l)),
        ).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.7]);
    });

    it('reads a missing or corrupt level as "not held"', () => {
        expect(tokenShieldShare(undefined)).toBe(0);
        expect(tokenShieldShare(Number.NaN)).toBe(0);
        expect(tokenShieldShare(-3)).toBe(0);
    });
});

describe('splitting a hit', () => {
    it('moves 10% onto SP at level 1, leaving 90% on HP', () => {
        expect(splitTokenShieldDamage(100, 1, 999)).toEqual({ hp: 90, sp: 10 });
    });

    it('walks the owner ladder: 20/80 … 45/55, then +5% a level', () => {
        // 2026-11-15：前 4 级不变，第 5 级起每级 +5%，到 10 级 70%。
        expect(splitTokenShieldDamage(100, 2, 999)).toEqual({ hp: 80, sp: 20 });
        expect(splitTokenShieldDamage(100, 3, 999)).toEqual({ hp: 70, sp: 30 });
        expect(splitTokenShieldDamage(100, 4, 999)).toEqual({ hp: 60, sp: 40 });
        expect(splitTokenShieldDamage(100, 5, 999)).toEqual({ hp: 55, sp: 45 });
        expect(splitTokenShieldDamage(100, 6, 999)).toEqual({ hp: 50, sp: 50 });
        expect(splitTokenShieldDamage(100, 7, 999)).toEqual({ hp: 45, sp: 55 });
        expect(splitTokenShieldDamage(100, 8, 999)).toEqual({ hp: 40, sp: 60 });
        expect(splitTokenShieldDamage(100, 9, 999)).toEqual({ hp: 35, sp: 65 });
        expect(splitTokenShieldDamage(100, 10, 999)).toEqual({ hp: 30, sp: 70 });
    });

    it('does nothing at all without the shield', () => {
        expect(splitTokenShieldDamage(100, 0, 999)).toEqual({ hp: 100, sp: 0 });
        expect(splitTokenShieldDamage(100, undefined, 999)).toEqual({ hp: 100, sp: 0 });
    });

    it('goes quiet when the blue bar cannot pay the whole share', () => {
        // 10 of 100 needed, only 9 in the pool: the full hit lands on HP.
        expect(splitTokenShieldDamage(100, 1, 9)).toEqual({ hp: 100, sp: 0 });
        // Exactly enough is enough.
        expect(splitTokenShieldDamage(100, 1, 10)).toEqual({ hp: 90, sp: 10 });
        // 5 级要 45 点蓝，池里只有 44 —— 全额掉血。
        expect(splitTokenShieldDamage(100, 5, 44)).toEqual({ hp: 100, sp: 0 });
        expect(splitTokenShieldDamage(100, 5, 45)).toEqual({ hp: 55, sp: 45 });
    });

    it('never conjures SP out of a zero or negative pool', () => {
        expect(splitTokenShieldDamage(40, 3, 0)).toEqual({ hp: 40, sp: 0 });
        expect(splitTokenShieldDamage(40, 3, -5)).toEqual({ hp: 40, sp: 0 });
    });

    it('keeps the arithmetic on whole numbers', () => {
        // 10% of 45 is 4.5 - the pool and the bar both hold integers.
        const split = splitTokenShieldDamage(45, 1, 999);
        expect(split.sp + split.hp).toBe(45);
        expect(Number.isInteger(split.sp)).toBe(true);
        expect(Number.isInteger(split.hp)).toBe(true);
    });

    it('still converts at least one point on a tiny hit', () => {
        // A 3-damage tick must not round the shield away into nothing.
        expect(splitTokenShieldDamage(3, 1, 999)).toEqual({ hp: 2, sp: 1 });
    });

    it('treats a zero-damage hit as nothing to split', () => {
        expect(splitTokenShieldDamage(0, 5, 999)).toEqual({ hp: 0, sp: 0 });
    });
});

describe('picking one up', () => {
    it('climbs one level per pickup', () => {
        expect(collectTokenShield(undefined)).toEqual({ level: 1, refilledHp: false, refilledSp: false });
        expect(collectTokenShield(1)).toEqual({ level: 2, refilledHp: false, refilledSp: false });
        expect(collectTokenShield(4)).toEqual({ level: 5, refilledHp: false, refilledSp: false });
    });

    it('stops at max and refills both bars instead', () => {
        // 上限 10 级以后，第 11 个开始只补满。
        expect(collectTokenShield(9)).toEqual({ level: 10, refilledHp: false, refilledSp: false });
        expect(collectTokenShield(10)).toEqual({ level: 10, refilledHp: true, refilledSp: true });
        expect(collectTokenShield(14)).toEqual({ level: 10, refilledHp: true, refilledSp: true });
    });
});
describe('the ten-level ladder', () => {
    it('runs 10% a level to four, then +5% a level to 70%', () => {
        // 主人 2026-11-12：`改为5级每级效果`；2026-11-15：`将上限改为10级`。
        expect(tokenShieldLevels()).toEqual([
            { level: 1, percent: 10 },
            { level: 2, percent: 20 },
            { level: 3, percent: 30 },
            { level: 4, percent: 40 },
            { level: 5, percent: 45 },
            { level: 6, percent: 50 },
            { level: 7, percent: 55 },
            { level: 8, percent: 60 },
            { level: 9, percent: 65 },
            { level: 10, percent: 70 },
        ]);
    });

    it('agrees with the damage splitter at every level', () => {
        for (const row of tokenShieldLevels()) {
            expect(tokenShieldShare(row.level)).toBeCloseTo(row.percent / 100, 5);
        }
    });
});
