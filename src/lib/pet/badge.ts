/**
 * src/lib/pet/badge.ts
 * --------------------------------------------------------------------------
 * The desktop-pet buff, as numbers a HUD chip can print.
 *
 * The owner's ask: `鲸鱼娘桌宠联动的那个buff要显示出来，加在键鼠操作的左边，悬浮显示有什么
 * 加成`. The numbers already existed in three places - the panel percentages in
 * `applyPetBonus`, the flat luck ladder, and the four extras in `WHALE_BLESSING` - but nothing
 * told the player which of them were live this run. This module answers exactly that, and
 * returns `null` when the answer is "nothing": no pet, no buff, or a character the pet does
 * not companion.
 */

import {
    PET_BLESSING_PERCENT,
    WHALE_BLESSING,
    petBonusAppliesTo,
    petLuckBonus,
} from './bonus';

export interface PetBuffFacts {
    /** The panel percentage the pet adds to HP / SP / move speed. */
    percent: number;
    /** Flat luck from the ladder. */
    luck: number;
    /** True when the maxed-tier extras are on as well. */
    blessing: boolean;
    /** Damage multiplier from the blessing (1 when off). */
    damageMul: number;
    /** Skill-cooldown multiplier from the blessing (1 when off). */
    cooldownMul: number;
    /** HP restored per second as a share of max HP (0 when off). */
    hpRegenPerSecPct: number;
    /** Extra SP per second as a share of max SP (0 when off). */
    spRegenPerSecPct: number;
}

/**
 * What the pet is worth to this character right now, or `null` for "no chip".
 *
 * The pet buffs DeepSeek only, so every other character gets `null` rather than a chip that
 * says +0% - a badge that is always there and never means anything is a badge players learn
 * to ignore.
 */
export function petBuffFacts(
    percent: number | null | undefined,
    characterId: string | undefined,
): PetBuffFacts | null {
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent <= 0) return null;
    if (!petBonusAppliesTo(characterId)) return null;

    const blessing = percent >= PET_BLESSING_PERCENT;
    return {
        percent,
        luck: petLuckBonus(percent),
        blessing,
        damageMul: blessing ? WHALE_BLESSING.damageMul : 1,
        cooldownMul: blessing ? WHALE_BLESSING.cooldownMul : 1,
        hpRegenPerSecPct: blessing ? WHALE_BLESSING.hpRegenPerSecPct : 0,
        spRegenPerSecPct: blessing ? WHALE_BLESSING.spRegenPerSecPct : 0,
    };
}