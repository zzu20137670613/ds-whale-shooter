/**
 * src/lib/characters/skill-scaling.ts
 * --------------------------------------------------------------------------
 * How the character's skill grows with the tavern ladders.
 *
 * The owner's rule: every upgrade level adds 10 to the skill's SP cost and takes
 * 2 seconds off its cooldown. Cost rising as you grow is deliberate - the pool
 * grows faster than the price, and a skill that stays free would never make you
 * choose.
 *
 * "Level" is the armour ladder (0..5), the same 0-5 scale the vitals refill price
 * uses, so the whole shop speaks one language.
 *
 * The cooldown floors at `SKILL_MIN_COOLDOWN_MS`: a 2s-per-level cut would
 * otherwise drive a short skill to zero and make it spammable.
 */

import { SKILL_CD_REDUCTION_PER_LEVEL_MS, SKILL_MIN_COOLDOWN_MS, SKILL_SP_COST_PER_LEVEL } from '@/lib/constants';

/** SP cost after upgrade scaling. Never below 0. */
export function scaledSkillSpCost(baseCost: number, level: number): number {
    const base = Number.isFinite(baseCost) ? Math.max(0, Math.ceil(baseCost)) : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    return base + steps * SKILL_SP_COST_PER_LEVEL;
}

/** Cooldown after upgrade scaling, floored so a skill cannot become spam. */
export function scaledSkillCooldown(baseCooldownMs: number, level: number): number {
    const base = Number.isFinite(baseCooldownMs) ? Math.max(0, baseCooldownMs) : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    return Math.max(SKILL_MIN_COOLDOWN_MS, base - steps * SKILL_CD_REDUCTION_PER_LEVEL_MS);
}