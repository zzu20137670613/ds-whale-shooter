/**
 * tests/lib/weapons/range.test.ts
 * --------------------------------------------------------------------------
 * Ranged weapons gain reach with the ladder; melee weapons must not.
 */

import { describe, expect, it } from 'vitest';

import { rangeAtLevel } from '@/lib/weapons/range';
import { applyWeaponUpgrade } from '@/lib/weapons/upgrades';
import type { WeaponSpec } from '@/lib/weapons/types';

const RIFLE = {
    id: 'rifle',
    name: 'Rifle',
    damage: 20,
    cooldownMs: 160,
    range: 560,
    projectile: { speed: 22, visual: { radius: 5 } },
    upgrades: { costs: [10, 20, 30, 40, 50], damagePerLevel: [20, 25, 30, 35, 40, 45] },
} as unknown as WeaponSpec;

const SWORD = {
    id: 'sword',
    name: 'Sword',
    damage: 30,
    cooldownMs: 400,
    range: 100,
    hitWidth: 120,
    hitHeight: 120,
    upgrades: { costs: [10, 20, 30, 40, 50], damagePerLevel: [30, 40, 50, 60, 70, 80] },
} as unknown as WeaponSpec;

describe('rangeAtLevel', () => {
    it('is unchanged at level 0', () => {
        expect(rangeAtLevel(560, 0)).toBe(560);
    });

    it('adds ten percent per level, compounded', () => {
        expect(rangeAtLevel(560, 1)).toBeCloseTo(616);
        expect(rangeAtLevel(560, 2)).toBeCloseTo(677.6);
        // Five levels on a 1.1^5 curve is ~+61% reach.
        expect(rangeAtLevel(560, 5)).toBeCloseTo(560 * Math.pow(1.1, 5), 5);
    });

    it('ignores a malformed level', () => {
        expect(rangeAtLevel(560, -2)).toBe(560);
        expect(rangeAtLevel(560, Number.NaN)).toBe(560);
    });
});

describe('applyWeaponUpgrade range growth', () => {
    it('lengthens a ranged weapon', () => {
        expect(applyWeaponUpgrade(RIFLE, 1).range).toBe(616);
        expect(applyWeaponUpgrade(RIFLE, 5).range).toBe(902);
    });

    it('leaves the reach of a melee weapon alone', () => {
        // A melee `range` positions the swing hitbox - growing it would quietly
        // turn a sword into a polearm.
        expect(applyWeaponUpgrade(SWORD, 5).range).toBe(100);
    });

    it('leaves level 0 untouched (same object back)', () => {
        expect(applyWeaponUpgrade(RIFLE, 0)).toBe(RIFLE);
    });

    it('still scales damage alongside range', () => {
        const upgraded = applyWeaponUpgrade(RIFLE, 2);
        expect(upgraded.damage).toBe(30);
        expect(upgraded.range).toBe(678);
    });
});