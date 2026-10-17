/**
 * tests/lib/weapons/upgrades.test.ts
 * --------------------------------------------------------------------------
 * Weapon upgrade + ammo pricing math. The fixture uses ×1.5 so a
 * compounding mistake is obvious, and integer damages so the rounding
 * rule is visible.
 */
import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';
import {
    AMMO_REFILL_PRICE_PER_ROUND,
    ammoRefillPrice,
    applyWeaponUpgrade,
    maxWeaponUpgradeLevel,
    weaponUpgradeCost,
} from '@/lib/weapons/upgrades';

const YAML = `
name: Shotgun
damage: 5
cooldownMs: 800
range: 400
clipSize: 4
reloadTimeMs: 2400
bulletsPerShot: 5
projectile:
    speed: 22
    visual: { radius: 4, width: 16, height: 4, color: 1 }
upgrades:
    costs: [40, 90, 160]
    damageMulPerLevel: 1.5
`;

const PLAIN = `
name: Bare Hands
damage: 7
cooldownMs: 500
range: 100
hitWidth: 20
hitHeight: 20
`;

const spec = parseWeaponYaml(YAML, 'shotgun');
const plain = parseWeaponYaml(PLAIN, 'bare-hands');

describe('maxWeaponUpgradeLevel', () => {
    it('reads the ladder length', () => {
        expect(maxWeaponUpgradeLevel(spec)).toBe(3);
    });

    it('is zero for a weapon with no ladder', () => {
        expect(maxWeaponUpgradeLevel(plain)).toBe(0);
    });
});

describe('weaponUpgradeCost', () => {
    it('walks the ladder as levels are bought', () => {
        expect(weaponUpgradeCost(spec, 0)).toBe(40);
        expect(weaponUpgradeCost(spec, 1)).toBe(90);
        expect(weaponUpgradeCost(spec, 2)).toBe(160);
    });

    it('returns null once the ladder is maxed', () => {
        expect(weaponUpgradeCost(spec, 3)).toBeNull();
        expect(weaponUpgradeCost(spec, 99)).toBeNull();
    });

    it('returns null for a weapon with no ladder', () => {
        expect(weaponUpgradeCost(plain, 0)).toBeNull();
    });
});

describe('applyWeaponUpgrade', () => {
    it('returns the same object at level 0', () => {
        expect(applyWeaponUpgrade(spec, 0)).toBe(spec);
    });

    it('returns the same object for a weapon with no ladder', () => {
        expect(applyWeaponUpgrade(plain, 3)).toBe(plain);
    });

    it('compounds the damage multiplier', () => {
        // 5 * 1.5^2 = 11.25 -> 11
        expect(applyWeaponUpgrade(spec, 2).damage).toBe(11);
    });

    it('rounds to an integer damage', () => {
        // 5 * 1.5 = 7.5 -> 8
        expect(applyWeaponUpgrade(spec, 1).damage).toBe(8);
    });

    it('ignores levels beyond the ladder', () => {
        // 1.5^3 = 16.875 -> 17, not 1.5^99
        expect(applyWeaponUpgrade(spec, 99).damage).toBe(17);
    });

    it('never drops damage below 1', () => {
        const weak = parseWeaponYaml(
            YAML.replace('damage: 5', 'damage: 1').replace('damageMulPerLevel: 1.5', 'damageMulPerLevel: 0.01'),
            'shotgun',
        );

        expect(applyWeaponUpgrade(weak, 3).damage).toBe(1);
    });

    it('does not mutate the original spec', () => {
        applyWeaponUpgrade(spec, 3);

        expect(spec.damage).toBe(5);
    });

    it('leaves everything except damage alone', () => {
        const out = applyWeaponUpgrade(spec, 1);

        expect(out.clipSize).toBe(4);
        expect(out.cooldownMs).toBe(800);
        expect(out.range).toBe(400);
    });
});

describe('ammoRefillPrice', () => {
    it('charges per missing round', () => {
        expect(ammoRefillPrice([{ ammo: 1, clipSize: 5 }])).toBe(4 * AMMO_REFILL_PRICE_PER_ROUND);
    });

    it('sums across the whole hotbar', () => {
        const price = ammoRefillPrice([
            { ammo: 0, clipSize: 3 },
            { ammo: 2, clipSize: 4 },
        ]);

        expect(price).toBe(5 * AMMO_REFILL_PRICE_PER_ROUND);
    });

    it('costs nothing when every slot is already full', () => {
        expect(ammoRefillPrice([{ ammo: 4, clipSize: 4 }])).toBe(0);
    });

    it('is free for an empty hotbar', () => {
        expect(ammoRefillPrice([])).toBe(0);
    });

    it('ignores an over-full slot rather than paying the player', () => {
        expect(ammoRefillPrice([{ ammo: 9, clipSize: 4 }])).toBe(0);
    });
});