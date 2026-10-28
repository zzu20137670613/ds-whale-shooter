/**
 * tests/lib/weapons/reload.test.ts
 * --------------------------------------------------------------------------
 * Reload time is linear: -10% of the BASE per level, so five levels land on
 * exactly half the starting time - the owner's "满级比初始快一倍".
 *
 * Compounding would have given 0.9^5 = 0.59, which is not half; that is why this
 * is a subtraction and not a multiplication.
 */

import { describe, expect, it } from 'vitest';

import { reloadTimeAtLevel } from '@/lib/weapons/reload';
import { applyWeaponUpgrade } from '@/lib/weapons/upgrades';
import type { WeaponSpec } from '@/lib/weapons/types';

describe('reloadTimeAtLevel', () => {
    it('is unchanged at level 0', () => {
        expect(reloadTimeAtLevel(3200, 0)).toBe(3200);
    });

    it('takes ten percent of the base off per level', () => {
        expect(reloadTimeAtLevel(3200, 1)).toBe(2880);
        expect(reloadTimeAtLevel(3200, 2)).toBe(2560);
        expect(reloadTimeAtLevel(3200, 3)).toBe(2240);
        expect(reloadTimeAtLevel(3200, 4)).toBe(1920);
    });

    it('lands on exactly half at level 5', () => {
        expect(reloadTimeAtLevel(3200, 5)).toBe(1600);
        expect(reloadTimeAtLevel(1800, 5)).toBe(900);
    });

    it('never reaches zero, however long the ladder', () => {
        expect(reloadTimeAtLevel(3200, 99)).toBeGreaterThan(0);
    });

    it('ignores a malformed level', () => {
        expect(reloadTimeAtLevel(3200, -3)).toBe(3200);
        expect(reloadTimeAtLevel(3200, Number.NaN)).toBe(3200);
    });
});

describe('applyWeaponUpgrade reload growth', () => {
    const MORTAR = {
        id: 'mortar',
        name: 'Mortar',
        damage: 70,
        cooldownMs: 1500,
        range: 700,
        clipSize: 3,
        reloadTimeMs: 3200,
        projectile: { speed: 14, visual: { radius: 9 } },
        upgrades: { costs: [10, 20, 30, 40, 50], damagePerLevel: [70, 82, 97, 116, 135, 160] },
    } as unknown as WeaponSpec;

    it('shortens reload along with the other ladder stats', () => {
        expect(applyWeaponUpgrade(MORTAR, 5).reloadTimeMs).toBe(1600);
    });

    it('leaves a weapon with no reload time alone', () => {
        const melee = { ...MORTAR, reloadTimeMs: undefined, projectile: undefined } as unknown as WeaponSpec;
        expect(applyWeaponUpgrade(melee, 5).reloadTimeMs).toBeUndefined();
    });
});