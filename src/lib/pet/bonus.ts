/**
 * src/lib/pet/bonus.ts
 * --------------------------------------------------------------------------
 * What the desktop pet's tier is worth in stats.
 *
 * One rule decides everything here: **the buff scales the panel, not the
 * tempo.** HP, SP and move speed go up; `spRegenMs` and the per-second regen
 * deliberately do not. 第七世 and I agreed on this twice - regen is pacing, and
 * scaling it would make a MAX pet refill so fast that ammo planning stops
 * mattering.
 *
 * Luck is the exception to "percent only": it gets a small FLAT bonus, because a
 * percentage of a number that means "10% crit per point" reads as nonsense. The
 * owner's ladder is +0 / +0 / +1 / +1 / +2, so a maxed pet turns a maxed Qwen
 * into a guaranteed crit - which he decided she has earned.
 *
 * Armour is left alone on purpose: it is a handful of flat points, and scaling it
 * would blunt the boss hits the design wants to still hurt.
 */

import type { CharacterSpec } from '@/lib/characters/types';

/** Stats the pet is allowed to touch. Explicit so a future stat is opt-in. */
export const PET_BONUSED_STATS = ['hp', 'sp', 'moveSpeed'] as const;

/**
 * Flat luck per bonus tier: +0 at 10-20%, +1 at 30-40%, +2 at 50%.
 *
 * Kept as explicit steps rather than a formula: the owner picked these numbers,
 * and a formula would invent values he never asked for on a re-tiered pet.
 */
export const PET_LUCK_LADDER = [
    { percentAtLeast: 50, luck: 2 },
    { percentAtLeast: 30, luck: 1 },
    { percentAtLeast: 0, luck: 0 },
] as const;

/** Luck a given pet percentage adds. */
export function petLuckBonus(percent: number): number {
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    for (const step of PET_LUCK_LADDER) {
        if (percent >= step.percentAtLeast) return step.luck;
    }
    return 0;
}

export type PetBonusedStat = (typeof PET_BONUSED_STATS)[number];

/** Whole numbers for pools; speed keeps its fraction. */
const INTEGER_STATS = new Set<PetBonusedStat>(['hp', 'sp']);

/**
 * Return a copy of `spec` with the pet's percentage applied.
 *
 * `percent` of 0 or less returns the spec untouched, so callers never need a
 * branch - and "no pet" is indistinguishable from "no bonus asked for".
 */
export function applyPetBonus(spec: CharacterSpec, percent: number): CharacterSpec {
    if (!Number.isFinite(percent) || percent <= 0) return spec;

    const factor = 1 + percent / 100;
    const patched: Record<string, unknown> = { ...spec };
    for (const stat of PET_BONUSED_STATS) {
        const base = spec[stat];
        if (typeof base !== 'number') continue;
        const raw = base * factor;
        patched[stat] = INTEGER_STATS.has(stat) ? Math.round(raw) : raw;
    }

    // Flat luck, capped at 10: past that a point buys nothing, and a HUD showing
    // 12/10 would be lying to the player.
    const luckBonus = petLuckBonus(percent);
    if (luckBonus > 0 && typeof spec.luck === 'number') {
        patched.luck = Math.min(10, spec.luck + luckBonus);
    }

    return patched as unknown as CharacterSpec;
}
