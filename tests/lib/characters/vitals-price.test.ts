/**
 * tests/lib/characters/vitals-price.test.ts
 * --------------------------------------------------------------------------
 * The vitals refill is priced off the armour ladder: 5 / 10 / 20 / 40 / 80 / 160.
 */

import { describe, expect, it } from 'vitest';

import { VITALS_RESTORE_PRICES, vitalsRestorePrice } from '@/lib/characters/vitals';

describe('vitalsRestorePrice', () => {
    it('walks the ladder the owner specified', () => {
        expect(VITALS_RESTORE_PRICES).toEqual([5, 10, 20, 40, 80, 160]);
        expect([0, 1, 2, 3, 4, 5].map(vitalsRestorePrice)).toEqual([5, 10, 20, 40, 80, 160]);
    });

    it('clamps out-of-range levels to the table', () => {
        expect(vitalsRestorePrice(-2)).toBe(5);
        expect(vitalsRestorePrice(9)).toBe(160);
        expect(vitalsRestorePrice(Number.NaN)).toBe(5);
        expect(vitalsRestorePrice(undefined)).toBe(5);
    });

    it('floors a fractional level', () => {
        expect(vitalsRestorePrice(2.9)).toBe(20);
    });
});