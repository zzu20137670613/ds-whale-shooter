/**
 * src/lib/characters/skill.ts
 * --------------------------------------------------------------------------
 * The character skill state machine. Pure — no scene, no Phaser, no store —
 * so the whole thing is testable and the controller only has to wire it.
 *
 * One runtime serves every kind:
 *
 *   headgear       worn; soaks `absorbHits` hits; cooldown starts on BREAK
 *   darkening      timed damage buff; cooldown starts on use
 *   critical-next  one-shot damage buff, spent by the next attack (miss or hit)
 *   divine-guest   `shieldHits` free hits, plus a timed damage buff
 *   dragon-roar    a cost and a cooldown here only; the monsters take the hit
 *                  in the monster module, which listens for the event
 *
 * The headgear is deliberately the odd one out: it cannot be re-worn while it
 * is on, and its cooldown is measured from the hit that broke it, not from the
 * press. Every other kind starts its cooldown the moment it is used.
 *
 * Timestamps are scene time in ms (`scene.time.now`).
 */

import type { CharacterSkillSpec } from '@/lib/characters/types';

export interface SkillRuntime {
    /** headgear: hits it can still soak up (0 = not worn). */
    hitsLeft: number;
    /** divine-guest: hits that deal no damage (0 = none left). */
    shieldLeft: number;
    /** One-shot damage multiplier for the next attack (1 = nothing armed). */
    nextMul: number;
    /** Timed damage multiplier, while `buffUntil` is still in the future. */
    buffMul: number;
    /** Earliest time the skill may be used again. */
    readyAt: number;
    /** When the timed buff lapses. */
    buffUntil: number;
}

export function emptySkillRuntime(): SkillRuntime {
    return { hitsLeft: 0, shieldLeft: 0, nextMul: 1, buffMul: 1, readyAt: 0, buffUntil: 0 };
}

/**
 * What one use costs in SP. `spCostFraction` scales with the character's own
 * cap — a flat cost would be trivial for a large pool and brutal for a small
 * one, which is the wrong knob for an ultimate.
 */
export function skillSpCost(skill: CharacterSkillSpec | undefined, maxSp: number): number {
    if (!skill) return 0;
    if ('spCostFraction' in skill) return Math.ceil(skill.spCostFraction * maxSp);
    return 'spCost' in skill ? skill.spCost : 0;
}

/** Whether a press would do anything right now. */
export function canUseSkill(
    skill: CharacterSkillSpec | undefined,
    runtime: SkillRuntime,
    now: number,
    sp: number,
    maxSp: number,
): boolean {
    if (!skill) return false;
    // A headgear that is still on cannot be put on again.
    if (skill.kind === 'headgear' && runtime.hitsLeft > 0) return false;
    if (now < runtime.readyAt) return false;
    return sp >= skillSpCost(skill, maxSp);
}

/** Returns the next runtime, whether anything was used, and what it cost. */
export function useSkill(
    skill: CharacterSkillSpec | undefined,
    runtime: SkillRuntime,
    now: number,
    sp: number,
    maxSp: number,
): { runtime: SkillRuntime; used: boolean; spCost: number } {
    if (!skill || !canUseSkill(skill, runtime, now, sp, maxSp)) {
        return { runtime, used: false, spCost: 0 };
    }
    const next: SkillRuntime = { ...runtime };
    // The headgear's clock starts when it breaks, in absorbIncomingHit.
    if (skill.kind !== 'headgear') next.readyAt = now + skill.cooldownMs;

    switch (skill.kind) {
        case 'headgear':
            next.hitsLeft = skill.absorbHits;
            break;
        case 'darkening':
            next.buffUntil = now + skill.buffMs;
            next.buffMul = skill.damageMul;
            break;
        case 'critical-next':
            next.nextMul = skill.damageMul;
            break;
        case 'divine-guest':
            next.shieldLeft = skill.shieldHits;
            next.buffUntil = now + skill.buffMs;
            next.buffMul = skill.damageMul;
            break;
        case 'dragon-roar':
            // Nothing to arm — the monster module resolves the roar itself.
            break;
    }
    return { runtime: next, used: true, spCost: skillSpCost(skill, maxSp) };
}

/**
 * Which colour the HUD's E badge should show.
 *
 * `cooling` wins over `no-sp`: while the skill is still on cooldown the SP
 * readout is not the reason the press did nothing, so a grey badge is the
 * honest answer. A headgear that is still worn cannot be re-worn either, so
 * it counts as cooling.
 */
export type SkillBadgeTone = 'ready' | 'cooling' | 'no-sp';

export function skillBadgeTone(state: {
    readyInMs: number;
    sp: number;
    spCost: number;
    wornHits?: number;
}): SkillBadgeTone {
    if (state.readyInMs > 0) return 'cooling';
    if ((state.wornHits ?? 0) > 0) return 'cooling';
    if (state.sp < state.spCost) return 'no-sp';
    return 'ready';
}

/**
 * The multiplier to stamp on ONE attack. A `critical-next` is spent here, so
 * a shot that misses still consumes it — the owner asked for exactly that.
 */
export function attackMultiplier(
    runtime: SkillRuntime,
    now: number,
): { mul: number; runtime: SkillRuntime } {
    const timed = now < runtime.buffUntil ? runtime.buffMul : 1;
    return { mul: timed * runtime.nextMul, runtime: { ...runtime, nextMul: 1 } };
}

/**
 * Route one incoming hit through the skill. A divine guest's shield eats the
 * hit whole; otherwise a worn headgear soaks it and the last hit breaks it.
 */
export function absorbIncomingHit(
    skill: CharacterSkillSpec | undefined,
    runtime: SkillRuntime,
    now: number,
): { runtime: SkillRuntime; absorbed: boolean; brokeHeadgear: boolean } {
    if (runtime.shieldLeft > 0) {
        return {
            runtime: { ...runtime, shieldLeft: runtime.shieldLeft - 1 },
            absorbed: true,
            brokeHeadgear: false,
        };
    }
    if (skill?.kind === 'headgear' && runtime.hitsLeft > 0) {
        const hitsLeft = runtime.hitsLeft - 1;
        const broke = hitsLeft === 0;
        return {
            runtime: {
                ...runtime,
                hitsLeft,
                readyAt: broke ? now + skill.cooldownMs : runtime.readyAt,
            },
            absorbed: true,
            brokeHeadgear: broke,
        };
    }
    return { runtime, absorbed: false, brokeHeadgear: false };
}
