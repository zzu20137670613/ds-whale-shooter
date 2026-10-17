/**
 * tests/lib/characters/upgrades.test.ts
 * --------------------------------------------------------------------------
 * The tavern upgrade math: price ladders, level clamping, and the spec
 * scaling that makes a purchase actually change the character.
 *
 * The fixture uses round numbers (×1.10, ×1.20, +4) so a compounding
 * mistake shows up as an obviously wrong value rather than a near miss.
 */
import { describe, expect, it } from 'vitest';

import { parseCharacterYaml } from '@/lib/characters/parser';
import {
    applyUpgrades,
    clampUpgradeLevel,
    maxUpgradeLevel,
    upgradeCost,
} from '@/lib/characters/upgrades';

const YAML = `
id: dummy
name: Dummy
hp: 100
sp: 50
luck: 4
moveSpeed: 5
spRegenMs: 4000
body: { halfW: 16, halfH: 16 }
dodge: { spCost: 10, speed: 12, durationMs: 200, cooldownMs: 500 }
hotbar: []
upgrades:
    armor:
        costs: [10, 20, 40]
        effects:
            - { stat: hp, mode: mul, perLevel: 1.10 }
    agility:
        costs: [15, 30]
        effects:
            - { stat: moveSpeed, mode: mul, perLevel: 1.20 }
    spirit:
        costs: [5]
        effects:
            - { stat: sp, mode: mul, perLevel: 2 }
            - { stat: spRegenMs, mode: mul, perLevel: 0.5 }
    luck:
        costs: [8, 16]
        effects:
            - { stat: luck, mode: add, perLevel: 4 }
`;

const spec = parseCharacterYaml(YAML, 'dummy');

describe('clampUpgradeLevel', () => {
    it('treats a missing or non-finite level as zero', () => {
        expect(clampUpgradeLevel(undefined, 3)).toBe(0);
        expect(clampUpgradeLevel(Number.NaN, 3)).toBe(0);
        expect(clampUpgradeLevel(Number.POSITIVE_INFINITY, 3)).toBe(0);
    });

    it('clamps into [0, ladderLength] and floors fractions', () => {
        expect(clampUpgradeLevel(-2, 3)).toBe(0);
        expect(clampUpgradeLevel(1.9, 3)).toBe(1);
        expect(clampUpgradeLevel(9, 3)).toBe(3);
    });
});

describe('maxUpgradeLevel', () => {
    it('reads the ladder length', () => {
        expect(maxUpgradeLevel(spec, 'armor')).toBe(3);
        expect(maxUpgradeLevel(spec, 'luck')).toBe(2);
    });

    it('is zero for an upgrade the character does not sell', () => {
        expect(maxUpgradeLevel(spec, 'nope')).toBe(0);
    });
});

describe('upgradeCost', () => {
    it('walks the ladder as levels are bought', () => {
        expect(upgradeCost(spec, 'armor', 0)).toBe(10);
        expect(upgradeCost(spec, 'armor', 1)).toBe(20);
        expect(upgradeCost(spec, 'armor', 2)).toBe(40);
    });

    it('returns null once the ladder is maxed', () => {
        expect(upgradeCost(spec, 'armor', 3)).toBeNull();
        expect(upgradeCost(spec, 'armor', 99)).toBeNull();
    });

    it('returns null for an upgrade the character does not sell', () => {
        expect(upgradeCost(spec, 'nope', 0)).toBeNull();
    });
});

describe('applyUpgrades', () => {
    it('returns the spec untouched when nothing is bought', () => {
        const out = applyUpgrades(spec, {});

        expect(out.hp).toBe(100);
        expect(out.moveSpeed).toBe(5);
        expect(out.sp).toBe(50);
        expect(out.spRegenMs).toBe(4000);
        expect(out.luck).toBe(4);
    });

    it('returns the same object for a character with no upgrade block', () => {
        const plain = parseCharacterYaml(
            YAML.split('upgrades:')[0] as string,
            'dummy',
        );

        expect(applyUpgrades(plain, { armor: 5 })).toBe(plain);
    });

    it('compounds a multiplicative upgrade per level', () => {
        // 100 * 1.10^2 = 121
        expect(applyUpgrades(spec, { armor: 2 }).hp).toBe(121);
    });

    it('keeps fractional movement speed', () => {
        // 5 * 1.20^2 = 7.2
        expect(applyUpgrades(spec, { agility: 2 }).moveSpeed).toBeCloseTo(7.2, 6);
    });

    it('applies every effect of a single upgrade', () => {
        const out = applyUpgrades(spec, { spirit: 1 });

        expect(out.sp).toBe(100); // 50 * 2
        expect(out.spRegenMs).toBe(2000); // 4000 * 0.5 — lower ms = faster
    });

    it('clamps an added stat to the range the schema accepts', () => {
        // 4 + 4*2 = 12, and luck is capped at 10 (crit chance 100%).
        expect(applyUpgrades(spec, { luck: 2 }).luck).toBe(10);
    });

    it('ignores levels beyond the ladder instead of over-upgrading', () => {
        expect(applyUpgrades(spec, { armor: 99 }).hp).toBe(133); // 1.10^3, not ^99
    });

    it('does not mutate the spec it was given', () => {
        applyUpgrades(spec, { armor: 3, agility: 2, luck: 2 });

        expect(spec.hp).toBe(100);
        expect(spec.moveSpeed).toBe(5);
        expect(spec.luck).toBe(4);
    });

    it('leaves unrelated fields alone', () => {
        const out = applyUpgrades(spec, { armor: 1 });

        expect(out.id).toBe('dummy');
        expect(out.name).toBe('Dummy');
        expect(out.body).toEqual({ halfW: 16, halfH: 16 });
        expect(out.upgrades).toBeDefined();
    });
});