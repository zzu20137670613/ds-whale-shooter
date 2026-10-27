/**
 * tests/lib/pet/bonus.test.ts
 * --------------------------------------------------------------------------
 * The pet's percentage, and the two things it must not touch.
 *
 * `spRegenMs` and `luck` are the interesting cases: both are numbers on the same
 * spec, both would be easy to include in a "scale everything" loop, and both
 * would change the game rather than the character.
 */

import { describe, expect, it } from 'vitest';

import { applyPetBonus } from '@/lib/pet/bonus';
import type { CharacterSpec } from '@/lib/characters/types';

/** Seed's real numbers, trimmed to what the buff reads. */
const SEED = {
    id: 'seed',
    name: 'Seed',
    nameZh: 'Seed',
    hp: 105,
    sp: 90,
    luck: 6,
    moveSpeed: 5.2,
    spRegenMs: 2600,
    body: { halfW: 28, halfH: 28 },
} as unknown as CharacterSpec;

describe('applyPetBonus', () => {
    it('scales hp and sp, rounded to whole points', () => {
        const buffed = applyPetBonus(SEED, 50);
        expect(buffed.hp).toBe(158); // 105 * 1.5 = 157.5 -> 158
        expect(buffed.sp).toBe(135);
    });

    it('scales move speed, keeping the fraction', () => {
        expect(applyPetBonus(SEED, 10).moveSpeed).toBeCloseTo(5.72, 5);
    });

    it('leaves the regen tempo alone', () => {
        // Agreed with 第七世: regen is pacing, not panel. Scaling it would make a
        // MAX pet refill so fast that ammo planning stops mattering.
        expect(applyPetBonus(SEED, 50).spRegenMs).toBe(2600);
    });

    it('adds flat luck instead of scaling it, and never past 10', () => {
        // The owner's ladder: +0 / +0 / +1 / +1 / +2.
        expect(applyPetBonus(SEED, 10).luck).toBe(6);
        expect(applyPetBonus(SEED, 20).luck).toBe(6);
        expect(applyPetBonus(SEED, 30).luck).toBe(7);
        expect(applyPetBonus(SEED, 40).luck).toBe(7);
        expect(applyPetBonus(SEED, 50).luck).toBe(8);
    });

    it('caps luck at 10, so a maxed Qwen is not carrying a meaningless 12', () => {
        const qwen = { ...SEED, luck: 10 };
        expect(applyPetBonus(qwen, 50).luck).toBe(10);
    });

    it('does not mutate the spec it was given', () => {
        const before = JSON.stringify(SEED);
        applyPetBonus(SEED, 50);
        expect(JSON.stringify(SEED)).toBe(before);
    });

    it('returns the same spec for zero, negative or nonsense percentages', () => {
        expect(applyPetBonus(SEED, 0)).toBe(SEED);
        expect(applyPetBonus(SEED, -10)).toBe(SEED);
        expect(applyPetBonus(SEED, NaN)).toBe(SEED);
    });

    it('walks the real tiers without drama', () => {
        const tiers = [10, 20, 30, 40, 50].map((p) => applyPetBonus(SEED, p).hp as number);
        expect(tiers).toEqual([116, 126, 137, 147, 158]);
        expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
    });

    it('keeps everything else on the spec', () => {
        const buffed = applyPetBonus(SEED, 50);
        expect(buffed.id).toBe('seed');
        expect(buffed.body).toEqual({ halfW: 28, halfH: 28 });
    });
});
