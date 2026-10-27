/**
 * tests/lib/weapons/upgrades.test.ts
 * --------------------------------------------------------------------------
 * Weapon upgrade + ammo pricing math. The fixture uses ×1.5 so a
 * compounding mistake is obvious, and integer damages so the rounding
 * rule is visible.
 */
import { describe, expect, it } from 'vitest';

import { reserveMaxFor } from '@/lib/weapons/ammo';
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

/**
 * The owner asked for the ladder to be writable as explicit numbers, the same
 * way `costs` already is: "写成死值". These cover the branch that reads them.
 */
const EXPLICIT_YAML = `
name: Table Gun
damage: 4
cooldownMs: 100
range: 500
projectile:
    speed: 20
    visual: { radius: 4, width: 16, height: 4, color: 1 }
upgrades:
    costs: [40, 90, 160]
    damagePerLevel: [4, 5, 7, 10]
`;

describe('an explicit damage ladder', () => {
    const ID = 'table-gun';

    it('uses the YAML numbers verbatim, base index 0', () => {
        const spec = parseWeaponYaml(EXPLICIT_YAML, ID);
        expect(applyWeaponUpgrade(spec, 0).damage).toBe(4);
        expect(applyWeaponUpgrade(spec, 1).damage).toBe(5);
        expect(applyWeaponUpgrade(spec, 2).damage).toBe(7);
        expect(applyWeaponUpgrade(spec, 3).damage).toBe(10);
    });

    it('beats damageMulPerLevel when both are present', () => {
        const both = parseWeaponYaml(
            EXPLICIT_YAML.replace(
                'damagePerLevel: [4, 5, 7, 10]',
                'damagePerLevel: [4, 5, 7, 10]\n    damageMulPerLevel: 2',
            ),
            ID,
        );
        // 4 * 2^1 would be 8; the table says 5 and the table wins.
        expect(applyWeaponUpgrade(both, 1).damage).toBe(5);
    });

    it('can express a level that is deliberately flat', () => {
        const flat = parseWeaponYaml(
            EXPLICIT_YAML.replace('damagePerLevel: [4, 5, 7, 10]', 'damagePerLevel: [4, 5, 5, 9]'),
            ID,
        );
        expect(applyWeaponUpgrade(flat, 2).damage).toBe(5);
    });

    it('rejects a table that does not cover base + every level', () => {
        // Three costs means four entries: base, lv1, lv2, lv3.
        const short = EXPLICIT_YAML.replace(
            'damagePerLevel: [4, 5, 7, 10]',
            'damagePerLevel: [4, 5, 7]',
        );
        expect(() => parseWeaponYaml(short, ID)).toThrow(/damagePerLevel/);
    });

    it('rejects a ladder that offers neither a table nor a multiplier', () => {
        const neither = EXPLICIT_YAML.replace(/\n    damagePerLevel: \[4, 5, 7, 10\]/, '');
        expect(() => parseWeaponYaml(neither, ID)).toThrow(/damagePerLevel|damageMulPerLevel/);
    });
});

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
            YAML.replace('damage: 5', 'damage: 1').replace(
                'damageMulPerLevel: 1.5',
                'damageMulPerLevel: 0.01',
            ),
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
    it('charges per missing reserve round', () => {
        // A 5-round magazine carries 5 * AMMO_RESERVE_CLIPS spare rounds.
        const reserveMax = reserveMaxFor(5);
        expect(ammoRefillPrice([{ reserve: 0, clipSize: 5 }])).toBe(
            reserveMax * AMMO_REFILL_PRICE_PER_ROUND,
        );
    });

    it('charges only the missing part', () => {
        const reserveMax = reserveMaxFor(4);
        const price = ammoRefillPrice([
            { reserve: reserveMax - 2, clipSize: 4 },
            { reserve: reserveMax, clipSize: 4 },
        ]);
        expect(price).toBe(2 * AMMO_REFILL_PRICE_PER_ROUND);
    });

    it('costs nothing when every reserve is already full', () => {
        expect(ammoRefillPrice([{ reserve: reserveMaxFor(4), clipSize: 4 }])).toBe(0);
    });

    it('is free for an empty hotbar', () => {
        expect(ammoRefillPrice([])).toBe(0);
    });

    it('does not pay the player for an over-full reserve', () => {
        expect(ammoRefillPrice([{ reserve: reserveMaxFor(4) + 5, clipSize: 4 }])).toBe(0);
    });
});
