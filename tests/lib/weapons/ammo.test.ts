/**
 * tests/lib/weapons/ammo.test.ts
 * --------------------------------------------------------------------------
 * Reserve ammunition arithmetic.
 *
 * The owner's framing: the weapon card's right-hand number "现在锁死了" - it was
 * `clipSize`, a constant, while a reload refilled the magazine for free. Every
 * case below is a way that number now actually matters.
 */

import { describe, expect, it } from 'vitest';

import {
    addReserve,
    canReloadFromReserve,
    reloadFromReserve,
    reserveMaxFor,
} from '@/lib/weapons/ammo';
import { AMMO_RESERVE_CLIPS } from '@/lib/constants';

describe('reserveMaxFor', () => {
    it('is a small number of magazines', () => {
        expect(reserveMaxFor(35)).toBe(35 * AMMO_RESERVE_CLIPS);
        expect(reserveMaxFor(2)).toBe(2 * AMMO_RESERVE_CLIPS);
    });

    it('is zero for a weapon with no magazine', () => {
        expect(reserveMaxFor(0)).toBe(0);
    });

    it('takes a clip count so a gun can carry more or less than the default', () => {
        expect(reserveMaxFor(10, 3)).toBe(30);
    });
});

describe('canReloadFromReserve', () => {
    it('needs both a gap in the magazine and rounds in reserve', () => {
        expect(canReloadFromReserve(10, 20, 35)).toBe(true);
        expect(canReloadFromReserve(35, 20, 35)).toBe(false); // magazine full
        expect(canReloadFromReserve(10, 0, 35)).toBe(false); // nothing left
        expect(canReloadFromReserve(0, 0, 35)).toBe(false); // dry
    });
});

describe('reloadFromReserve', () => {
    it('fills the magazine and spends exactly the rounds it took', () => {
        expect(reloadFromReserve(10, 140, 35)).toEqual({ ammo: 35, reserve: 115, took: 25 });
    });

    it('partly fills when the reserve cannot cover the gap', () => {
        // 8 rounds left in reserve, magazine needs 25: you get 8, and the next
        // reload has nothing to give.
        expect(reloadFromReserve(10, 8, 35)).toEqual({ ammo: 18, reserve: 0, took: 8 });
    });

    it('does nothing when the magazine is already full', () => {
        expect(reloadFromReserve(35, 50, 35)).toEqual({ ammo: 35, reserve: 50, took: 0 });
    });

    it('does nothing with an empty reserve', () => {
        expect(reloadFromReserve(0, 0, 35)).toEqual({ ammo: 0, reserve: 0, took: 0 });
    });

    it('never produces a negative reserve', () => {
        const result = reloadFromReserve(0, 3, 35);
        expect(result.reserve).toBe(0);
        expect(result.ammo).toBe(3);
    });
});

describe('addReserve', () => {
    it('tops up without passing the cap', () => {
        expect(addReserve(100, 30, 140)).toBe(130);
        expect(addReserve(130, 30, 140)).toBe(140);
    });

    it('ignores nonsense amounts', () => {
        expect(addReserve(100, -5, 140)).toBe(100);
        expect(addReserve(100, 0, 140)).toBe(100);
    });

    it('floors fractional pickups, because rounds are whole things', () => {
        expect(addReserve(100, 10.9, 140)).toBe(110);
    });
});