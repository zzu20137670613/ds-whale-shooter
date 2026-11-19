/**
 * tests/lib/characters/grow-spec.test.ts
 * --------------------------------------------------------------------------
 * Buying a shop ladder has to change her body right then.
 *
 * The owner bought spirit and his HP/SP caps did not move: `applyUpgrades` only ran inside
 * `resolve-scene`, so the ledger rose and nothing read it until the next scene load. `growSpec`
 * applies one ladder's effects to the LIVE spec, which is what the character now calls when
 * the shop reports a level change.
 */

import { describe, expect, it } from 'vitest';

import type { CharacterSpec } from '@/lib/characters';
import { growSpec } from '@/lib/characters/upgrades';

const base = {
    hp: 110,
    sp: 90,
    moveSpeed: 5,
    armor: 0,
    luck: 3,
    spRegenPerSec: 0.5,
    upgrades: {
        spirit: {
            costs: [35, 70, 115, 170, 240],
            effects: [
                { stat: 'hp', mode: 'add', perLevel: 10 },
                { stat: 'sp', mode: 'add', perLevel: 10 },
                { stat: 'spRegenPerSec', mode: 'add', perLevel: 0.3 },
            ],
        },
        agility: {
            costs: [40, 80, 130, 190, 270],
            effects: [{ stat: 'moveSpeed', mode: 'add', perLevel: 0.3 }],
        },
        luck: {
            costs: [80, 160, 260, 400, 620],
            effects: [{ stat: 'luck', mode: 'add', perLevel: 1 }],
        },
    },
} as unknown as CharacterSpec;

describe('growSpec', () => {
    it('raises HP and SP caps by the ladder amount, one step at a time', () => {
        const once = growSpec(base, 'spirit', 1);
        expect(once.hp).toBe(120);
        expect(once.sp).toBe(100);
        expect(once.spRegenPerSec).toBeCloseTo(0.8, 6);
    });

    it('compounds across repeated purchases', () => {
        let spec = base;
        for (let i = 0; i < 5; i++) spec = growSpec(spec, 'spirit', 1);
        expect(spec.hp).toBe(160);
        expect(spec.sp).toBe(140);
        expect(spec.spRegenPerSec).toBeCloseTo(2.0, 6);
    });

    it('leaves the other ladders alone', () => {
        const spec = growSpec(base, 'spirit', 1);
        expect(spec.moveSpeed).toBe(5);
        expect(spec.luck).toBe(3);
    });

    it('handles the single-stat ladders too', () => {
        expect(growSpec(base, 'agility', 2).moveSpeed).toBeCloseTo(5.6, 6);
        expect(growSpec(base, 'luck', 3).luck).toBe(6);
    });

    it('is a no-op for zero, negative or unknown ladders', () => {
        expect(growSpec(base, 'spirit', 0)).toBe(base);
        expect(growSpec(base, 'spirit', -2)).toBe(base);
        expect(growSpec(base, 'nope', 1)).toBe(base);
    });

    it('never mutates the spec it was given', () => {
        growSpec(base, 'spirit', 2);
        expect(base.hp).toBe(110);
        expect(base.sp).toBe(90);
    });
});