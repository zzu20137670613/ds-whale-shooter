/**
 * src/lib/bosses/phase-reward.ts
 * --------------------------------------------------------------------------
 * What emptying one of Claude's bars pays out.
 *
 * The owner: `每打过一个阶段，弹药自动补满（只有第四阶段打完时自动补满血蓝，前三个阶段打完只补满
 * 所有武器的弹药/备弹）`.
 *
 * Ammunition is the per-phase reward; vitals join in from phase four, the beat before her final
 * form. Paying vitals on every phase would make the five-phase gauntlet trivial.
 */

/** Event the boss controller emits the moment a phase bar empties. */
export const BOSS_PHASE_CLEAR_EVENT = 'boss:phase-cleared';

/**
 * The first phase (one-based) whose clear also refills health and spirit.
 *
 * Four, not five: the owner asked for the vitals refill when phase FOUR falls. On a shorter
 * boss the rule still lands on the last phase, because `phaseClearReward` only ever compares
 * against this number.
 */
export const VITALS_REFILL_FROM_PHASE = 4;

export interface PhaseClearReward {
    /** Fill every ranged weapon's magazine and reserve. */
    ammo: boolean;
    /** Refill health and spirit as well. */
    vitals: boolean;
}

/**
 * The reward for clearing one phase.
 *
 * @param clearedIndex zero-based index of the phase that just emptied
 * @param vitalsFromPhase first one-based phase that also pays vitals
 */
export function phaseClearReward(
    clearedIndex: number,
    vitalsFromPhase = VITALS_REFILL_FROM_PHASE,
): PhaseClearReward {
    return {
        ammo: true,
        // `clearedIndex + 1` is the phase the player just finished.
        vitals: clearedIndex + 1 >= vitalsFromPhase,
    };
}