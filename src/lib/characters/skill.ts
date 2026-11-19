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
    /**
     * nine-lives: shield HP still standing (0 = not up).
     *
     * Kept apart from `hitsLeft` rather than overloading it: one counts hits, the other
     * counts damage, and a skill that silently switched meaning would break the HUD's
     * "worn" test in a way nobody would notice until a boss hit vanished.
     */
    shieldHp: number;
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
    return {
        hitsLeft: 0,
        shieldHp: 0,
        shieldLeft: 0,
        nextMul: 1,
        buffMul: 1,
        readyAt: 0,
        buffUntil: 0,
    };
}

/**
 * What one use costs in SP. `spCostFraction` scales with the character's own
 * cap — a flat cost would be trivial for a large pool and brutal for a small
 * one, which is the wrong knob for an ultimate.
 */
export function skillSpCost(skill: CharacterSkillSpec | undefined, maxSp: number): number {
    if (!skill) return 0;
    // A flat price wins when both are present: it is the one the owner can reason about.
    if ('spCost' in skill && typeof skill.spCost === 'number') return skill.spCost;
    const fraction = 'spCostFraction' in skill ? skill.spCostFraction : undefined;
    if (typeof fraction === 'number') return Math.ceil(fraction * maxSp);
    return 0;
}

/** Whether a press would do anything right now. */
export function canUseSkill(
    skill: CharacterSkillSpec | undefined,
    runtime: SkillRuntime,
    now: number,
    sp: number,
    maxSp: number,
    /** Upgrade-scaled cost. Defaults to the spec's own; see `scaledSkillSpCost`. */
    costOverride?: number,
): boolean {
    if (!skill) return false;
    // A ward that is still standing cannot be raised again.
    if (skill.kind === 'headgear' && runtime.hitsLeft > 0) return false;
    if (skill.kind === 'nine-lives' && runtime.shieldHp > 0) return false;
    if (now < runtime.readyAt) return false;
    return sp >= (costOverride ?? skillSpCost(skill, maxSp));
}

/** Returns the next runtime, whether anything was used, and what it cost. */
export function useSkill(
    skill: CharacterSkillSpec | undefined,
    runtime: SkillRuntime,
    now: number,
    sp: number,
    maxSp: number,
    /** Upgrade-scaled cooldown; defaults to the spec's own value. */
    cooldownMs?: number,
    /** Character upgrade level (0..5) — what scales a nine-lives shield. */
    skillLevel = 0,
    /**
     * The price actually charged, after the armour ladder's +10/level.
     *
     * Needed because the affordability check must use the same number: at level 5 a
     * 15 SP skill costs 65, and checking the base 15 would let a press through that
     * sends SP negative.
     */
    costOverride?: number,
): { runtime: SkillRuntime; used: boolean; spCost: number } {
    if (!skill || !canUseSkill(skill, runtime, now, sp, maxSp, costOverride)) {
        return { runtime, used: false, spCost: 0 };
    }
    const next: SkillRuntime = { ...runtime };
    // The headgear's clock starts when it breaks, in absorbIncomingHit.
    const effectiveCooldown = cooldownMs ?? skill.cooldownMs;
    if (skill.kind !== 'headgear' && skill.kind !== 'nine-lives') {
        next.readyAt = now + effectiveCooldown;
    }

    switch (skill.kind) {
        case 'headgear':
            next.hitsLeft = skill.absorbHits;
            break;
        case 'nine-lives':
            // Level 0 already grants one step: 15 / 30 / 45 / 60 / 75 / 90.
            next.shieldHp = skill.hpPerLevel * (skillLevel + 1);
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
    return { runtime: next, used: true, spCost: costOverride ?? skillSpCost(skill, maxSp) };
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
    /** nine-lives: shield HP still standing. */
    wornShield?: number;
}): SkillBadgeTone {
    if (state.readyInMs > 0) return 'cooling';
    if ((state.wornHits ?? 0) > 0) return 'cooling';
    if ((state.wornShield ?? 0) > 0) return 'cooling';
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
    /**
     * How much damage is arriving.
     *
     * Defaults to "one whole hit", which is what the older hit-counting kinds need and
     * what their callers have always passed (nothing). A nine-lives shield subtracts it
     * and hands the remainder on to HP.
     */
    damage = Number.POSITIVE_INFINITY,
    /** Upgrade-scaled cooldown; defaults to the spec's own value. */
    cooldownMs?: number,
): {
    runtime: SkillRuntime;
    absorbed: boolean;
    brokeHeadgear: boolean;
    brokeShield: boolean;
    /** Damage left over for HP after the ward. Infinity means "not routed". */
    remainingDamage: number;
} {
    if (runtime.shieldLeft > 0) {
        return {
            runtime: { ...runtime, shieldLeft: runtime.shieldLeft - 1 },
            absorbed: true,
            brokeHeadgear: false,
            brokeShield: false,
            remainingDamage: 0,
        };
    }
    if (skill?.kind === 'nine-lives' && runtime.shieldHp > 0) {
        const absorbed = Math.min(runtime.shieldHp, damage);
        const left = runtime.shieldHp - absorbed;
        const broke = left <= 0;
        return {
            runtime: {
                ...runtime,
                shieldHp: broke ? 0 : left,
                // Cooldown starts on the hit that breaks it, same as the headgear.
                readyAt: broke ? now + (cooldownMs ?? skill.cooldownMs) : runtime.readyAt,
            },
            absorbed: true,
            brokeHeadgear: false,
            brokeShield: broke,
            remainingDamage: Number.isFinite(damage) ? damage - absorbed : 0,
        };
    }
    if (skill?.kind === 'headgear' && runtime.hitsLeft > 0) {
        const hitsLeft = runtime.hitsLeft - 1;
        const broke = hitsLeft === 0;
        return {
            runtime: {
                ...runtime,
                hitsLeft,
                readyAt: broke ? now + (cooldownMs ?? skill.cooldownMs) : runtime.readyAt,
            },
            absorbed: true,
            brokeHeadgear: broke,
            brokeShield: false,
            remainingDamage: 0,
        };
    }
    return {
        runtime,
        absorbed: false,
        brokeHeadgear: false,
        brokeShield: false,
        remainingDamage: damage,
    };
}
