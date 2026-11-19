/**
 * tests/lib/characters/vitals.test.ts
 * --------------------------------------------------------------------------
 * HP/SP never regenerate on their own — the shop's paid refill is the only
 * deliberate way back up besides pickups. These are the rules it sells under.
 */

import { describe, expect, it } from 'vitest';

import {
    SHOP_RESTORE_VITALS_PRICE,
    canAffordRestore,
    canBuyRestore,
    isVitalsFull,
} from '@/lib/characters/vitals';

const FULL = { hp: 100, maxHp: 100, sp: 50, maxSp: 50 };

describe('vitals', () => {
    describe('isVitalsFull', () => {
        it('is full when both pools are topped up', () => {
            expect(isVitalsFull(FULL)).toBe(true);
        });

        it('is not full when HP is missing', () => {
            expect(isVitalsFull({ ...FULL, hp: 99 })).toBe(false);
        });

        it('is not full when SP is missing', () => {
            expect(isVitalsFull({ ...FULL, sp: 0 })).toBe(false);
        });
    });

    describe('canAffordRestore', () => {
        it('needs the full price', () => {
            expect(canAffordRestore(SHOP_RESTORE_VITALS_PRICE - 1)).toBe(false);
            expect(canAffordRestore(SHOP_RESTORE_VITALS_PRICE)).toBe(true);
        });
    });

    describe('canBuyRestore', () => {
        it('sells a refill to a hurt player who can pay', () => {
            expect(canBuyRestore({ ...FULL, hp: 10, money: 999 })).toBe(true);
        });

        it('refuses when the pools are already full', () => {
            expect(canBuyRestore({ ...FULL, money: 999 })).toBe(false);
        });

        it('refuses when the wallet is short', () => {
            expect(canBuyRestore({ ...FULL, hp: 10, money: 0 })).toBe(false);
        });
    });
});
