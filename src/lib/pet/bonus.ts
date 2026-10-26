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
 * `luck` is also left alone: it changes drop rolls, so scaling it would turn
 * the pet into a farming exploit rather than a companion.
 */

import type { CharacterSpec } from '@/lib/characters/types';

/** Stats the pet is allowed to touch. Explicit so a future stat is opt-in. */
export const PET_BONUSED_STATS = ['hp', 'sp', 'moveSpeed'] as const;

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
    return patched as unknown as CharacterSpec;
}
