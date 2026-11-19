/**
 * tests/lib/weapons/ammo-refill.test.ts
 * --------------------------------------------------------------------------
 * An ammo box has to put rounds in the reserve every single time.
 *
 * The owner's report: the first 弹药箱 refilled, the second added nothing — `点第二个时没加备弹
 * （还是备弹0）`. Three ways that could happen, all of them real:
 *
 *  1. `Math.round(clipSize * 0.3)` is **0** for any clip of 1 or 2 — the box is consumed and
 *     does nothing at all.
 *  2. The refill went to the ACTIVE slot, and that slot was a melee weapon: a sword has no
 *     reserve, so the rounds vanished into a number nothing reads.
 *  3. The cap came from `reserveMaxFor(clipSize)` with no level, so an upgraded weapon was
 *     capped at 2 clips no matter how big its real reserve is.
 */

import { describe, expect, it } from 'vitest';

import {
    pickRefillTargetIndex,
    refillReserve,
    refillReserveAmount,
} from '@/lib/weapons/ammo';

describe('how many rounds one ammo box gives', () => {
    it('never rounds down to nothing', () => {
        // 0.3 of a 1-round clip rounds to 0 — a box the player paid a bag slot for.
        expect(refillReserveAmount(1, 0.3)).toBe(1);
        expect(refillReserveAmount(2, 0.3)).toBe(1);
    });

    it('scales with the magazine', () => {
        expect(refillReserveAmount(5, 0.3)).toBe(2);
        expect(refillReserveAmount(25, 0.3)).toBe(8);
    });

    it('survives a nonsense fraction instead of throwing', () => {
        expect(refillReserveAmount(5, 0)).toBe(1);
        expect(refillReserveAmount(5, Number.NaN)).toBe(1);
    });
});

describe('putting those rounds in the reserve', () => {
    it('adds, it does not set', () => {
        expect(refillReserve(0, 5, 0.3, 0)).toBe(2);
        expect(refillReserve(2, 5, 0.3, 0)).toBe(4);
        expect(refillReserve(4, 5, 0.3, 0)).toBe(6);
    });

    it('stops at the real cap for the weapon level', () => {
        // clip 5: level 0 reserve cap 10, level 5 cap 35. Using the level-0 cap on a levelled
        // weapon threw away most of the box.
        expect(refillReserve(9, 5, 0.3, 0)).toBe(10);
        expect(refillReserve(30, 5, 0.3, 5)).toBe(32);
        expect(refillReserve(34, 5, 0.3, 5)).toBe(35);
    });

    it('is idempotent at the cap instead of overflowing', () => {
        expect(refillReserve(10, 5, 0.3, 0)).toBe(10);
    });
});

describe('which slot the box feeds', () => {
    interface Slot {
        spec: { bullet?: { type?: string }; hitWidth?: number };
    }
    const melee: Slot = { spec: { hitWidth: 40 } };
    const meleeByType: Slot = { spec: { bullet: { type: 'melee' } } };
    const gun: Slot = { spec: { bullet: { type: 'projectile' } } };
    const cannon: Slot = { spec: { bullet: { type: 'projectile' } } };

    it('feeds the active weapon when it can fire', () => {
        expect(pickRefillTargetIndex([gun, cannon], 1)).toBe(1);
    });

    it('skips a melee weapon in hand and feeds a gun instead', () => {
        // This is the case that ate the box: rounds went into 鲸尾重击's dead reserve field.
        expect(pickRefillTargetIndex([melee, gun], 0)).toBe(1);
        expect(pickRefillTargetIndex([meleeByType, cannon], 0)).toBe(1);
    });

    it('reports -1 when she carries nothing ranged', () => {
        expect(pickRefillTargetIndex([melee, meleeByType], 0)).toBe(-1);
        expect(pickRefillTargetIndex([], 0)).toBe(-1);
    });
});
