/**
 * tests/lib/characters/combat.test.ts
 * --------------------------------------------------------------------------
 * Armour and crit maths, both of which the owner just re-specified.
 *
 * Armour is now FLAT: level 1 soaks 5, level 5 soaks 25, and an overflow soaks
 * everything (floor 0 - never negative damage, so a hit can never heal).
 *
 * Luck is now worth a full crit: luck 10 means always, because
 * COMBAT_CRIT_MULTIPLIER went from 0.5 to 1.0.
 */

import { describe, expect, it } from 'vitest';

import { critChance, damageAfterArmor, isCriticalHit } from '@/lib/characters/combat';
import { ARMOR_PER_LEVEL, COMBAT_CRIT_MULTIPLIER } from '@/lib/constants';

describe('damageAfterArmor', () => {
    it('subtracts flat armour', () => {
        expect(damageAfterArmor(40, 0)).toBe(40);
        expect(damageAfterArmor(40, 5)).toBe(35);
        expect(damageAfterArmor(40, 25)).toBe(15);
    });

    it('never goes negative', () => {
        expect(damageAfterArmor(8, 25)).toBe(0);
        expect(damageAfterArmor(0, 25)).toBe(0);
    });

    it('treats a hit it fully soaks as zero, not healing', () => {
        // The owner was explicit: overflow means no damage, never a heal.
        expect(damageAfterArmor(5, 5)).toBe(0);
        expect(damageAfterArmor(5, 5)).toBeGreaterThanOrEqual(0);
    });

    it('ignores negative armour and negative damage', () => {
        expect(damageAfterArmor(10, -5)).toBe(10);
        expect(damageAfterArmor(-10, 0)).toBe(0);
    });

    it('scales with the ladder the owner specified', () => {
        const ladder = [0, 1, 2, 3, 4, 5].map((level) => level * ARMOR_PER_LEVEL);
        expect(ladder).toEqual([0, 5, 10, 15, 20, 25]);
    });
});

describe('critChance', () => {
    it('is luck / 10 with the global multiplier applied', () => {
        expect(critChance(1)).toBeCloseTo(0.1 * COMBAT_CRIT_MULTIPLIER);
        expect(critChance(5)).toBeCloseTo(0.5 * COMBAT_CRIT_MULTIPLIER);
        expect(critChance(10)).toBeCloseTo(1);
    });

    it('is certain at luck 10 now that the multiplier is 1', () => {
        expect(COMBAT_CRIT_MULTIPLIER).toBe(1);
        expect(critChance(10)).toBe(1);
    });

    it('clamps luck into 1..10 and never exceeds 1', () => {
        expect(critChance(0)).toBeCloseTo(0.1);
        expect(critChance(99)).toBe(1);
    });
});

describe('isCriticalHit', () => {
    it('always crits at certainty', () => {
        expect(isCriticalHit(10, () => 0.999)).toBe(true);
    });

    it('never crits on a roll above the chance', () => {
        expect(isCriticalHit(1, () => 0.95)).toBe(false);
    });

    it('uses the injected roll', () => {
        expect(isCriticalHit(5, () => 0.1)).toBe(true);
        expect(isCriticalHit(5, () => 0.9)).toBe(false);
    });
});