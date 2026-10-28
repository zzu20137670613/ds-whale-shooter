/**
 * tests/lib/pet/blessing.test.ts
 * --------------------------------------------------------------------------
 * 鲸鲸祝福 is the max-tier pet, plus +50% damage, half skill cooldown, 2%/s HP
 * regen and +1% max-SP/s regen.
 *
 * The gating matters as much as the numbers: a mid-tier pet must NOT hand out the
 * blessing, and no other character may ever see it.
 */

import { describe, expect, it } from 'vitest';

import {
    PET_BLESSING_PERCENT,
    WHALE_BLESSING,
    applyBlessingDamage,
    blessingApplies,
} from '@/lib/pet/bonus';
import type { WeaponSpec } from '@/lib/weapons/types';

describe('blessingApplies', () => {
    it('needs the maxed pet tier', () => {
        expect(PET_BLESSING_PERCENT).toBe(50);
        expect(blessingApplies('deepseek', 50)).toBe(true);
        expect(blessingApplies('deepseek', 40)).toBe(false);
        expect(blessingApplies('deepseek', 0)).toBe(false);
    });

    it('is DeepSeek only', () => {
        for (const who of ['claude', 'gpt', 'qwen', 'seed', undefined]) {
            expect(blessingApplies(who, 50), String(who)).toBe(false);
        }
    });
});

describe('the blessing numbers', () => {
    it('are the four the owner asked for', () => {
        expect(WHALE_BLESSING.damageMul).toBe(1.5);
        expect(WHALE_BLESSING.cooldownMul).toBe(0.5);
        expect(WHALE_BLESSING.hpRegenPerSecPct).toBe(0.02);
        expect(WHALE_BLESSING.spRegenPerSecPct).toBe(0.01);
    });

    it('adds half again on a weapon, rounded to a whole point', () => {
        const spec = { id: 'x', name: 'X', damage: 45 } as WeaponSpec;
        expect(applyBlessingDamage(spec).damage).toBe(68);
        // Never drops below 1, however small the weapon.
        const pea = { id: 'y', name: 'Y', damage: 1 } as WeaponSpec;
        expect(applyBlessingDamage(pea).damage).toBe(2);
    });
});

describe('regen at max level', () => {
    // Maxed DeepSeek: 160 HP / 140 SP without a pet, 240 / 210 with it.
    it('heals 2% of max HP per second', () => {
        expect(240 * WHALE_BLESSING.hpRegenPerSecPct).toBeCloseTo(4.8);
        expect(160 * WHALE_BLESSING.hpRegenPerSecPct).toBeCloseTo(3.2);
    });

    it('adds 1% of max SP per second on top of the flat 2/s', () => {
        const flat = 2;
        expect(flat + 210 * WHALE_BLESSING.spRegenPerSecPct).toBeCloseTo(4.1);
        expect(flat + 140 * WHALE_BLESSING.spRegenPerSecPct).toBeCloseTo(3.4);
    });
});