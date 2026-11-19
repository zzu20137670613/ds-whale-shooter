/**
 * src/lib/characters/skill-scaling.ts
 * --------------------------------------------------------------------------
 * How the character's skill grows with the tavern ladders.
 *
 * The owner's rule: every upgrade level adds 10 to the skill's SP cost and takes
 * 2 seconds off its cooldown. Cost rising as you grow is deliberate - the pool
 * grows faster than the price, and a skill that stays free would never make you choose.
 *
 * Which ladder: the COST scales with **spirit** (the ladder that raises the SP pool by 10
 * a level), the COOLDOWN with **armour**. Reading armour for both used to leave a fully
 * upgraded skill costing more than the whole bar - 60 + 50 = 110 SP against Claude's 70.
 * Pairing the price with the pool keeps the trade honest at every level, and
 * `tests/lib/characters/skill-affordable.test.ts` pins it.
 *
 * The cooldown floors at `SKILL_MIN_COOLDOWN_MS`: a 2s-per-level cut would
 * otherwise drive a short skill to zero and make it spammable.
 */

import {
    SKILL_CD_REDUCTION_PER_LEVEL_MS,
    SKILL_MIN_COOLDOWN_MS,
    SKILL_SP_COST_PER_LEVEL,
} from '@/lib/constants';

/**
 * Which upgrade ladder feeds which half of the skill.
 *
 * The COST rides **spirit**, the only ladder that raises the SP pool (+10 a level), so the
 * price grows alongside the bar it is paid from. The COOLDOWN rides **armour**.
 *
 * Both used to read armour. For a flat price that is merely expensive; for a price charged as
 * a fraction of the pool it is fatal - see `scaledSkillSpCost`'s cap and
 * `tests/lib/characters/skill-castable.test.ts` (owner, 2026-11-14: `升级之后技能放不出来了`).
 */
export interface SkillLadders {
    /** Ladder the SP price follows - spirit. */
    cost: number;
    /** Ladder the cooldown follows - armour. */
    cooldown: number;
}

function ladderLevel(value: number | undefined): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}

/** Read both ladders out of the store's `upgradeLevels` in one place. */
export function skillLadders(levels: Record<string, number> = {}): SkillLadders {
    return {
        cost: ladderLevel(levels.spirit),
        cooldown: ladderLevel(levels.armor),
    };
}

/**
 * SP cost after upgrade scaling. Never below 0.
 *
 * `cap` is the character's own SP maximum: no press may ever cost more than the bar it is
 * paid from, or the skill becomes unusable forever (SP cannot exceed its own maximum). A
 * skill charged as a fraction of the pool therefore stays "the whole bar" at every level
 * instead of creeping 10 SP past it per upgrade.
 */
export function scaledSkillSpCost(baseCost: number, level: number, cap?: number): number {
    const base = Number.isFinite(baseCost) ? Math.max(0, Math.ceil(baseCost)) : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    const price = base + steps * SKILL_SP_COST_PER_LEVEL;
    // A cap of 0 or less is nonsense (a character with no pool): ignore it rather than
    // making every skill free. Only a real, positive maximum constrains the price.
    if (cap === undefined || !Number.isFinite(cap) || cap <= 0) return price;
    return Math.min(price, Math.floor(cap));
}

/** Cooldown after upgrade scaling, floored so a skill cannot become spam. */
export function scaledSkillCooldown(baseCooldownMs: number, level: number): number {
    const base = Number.isFinite(baseCooldownMs) ? Math.max(0, baseCooldownMs) : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    return Math.max(SKILL_MIN_COOLDOWN_MS, base - steps * SKILL_CD_REDUCTION_PER_LEVEL_MS);
}
