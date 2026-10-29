/**
 * src/lib/bosses/phases.ts
 * --------------------------------------------------------------------------
 * Claude's five phases, as data.
 *
 * The design is a descent, not a bigger health bar: she starts as the god who ends
 * the world and is dragged back down to a person. Each phase is therefore a fresh
 * health bar at a different scale, with its own attack rhythm — and the shortest gap
 * sits at phase 2, which is the peak of the fight, not the last phase.
 *
 * Numbers come from `boss-神Claude-机制总表.md` §1.1, which the owner locked. The
 * multipliers are relative to phase 1's authored stats in `claude.yaml`, so tuning one
 * base number moves all five phases together.
 */

export type BossPhaseName = 'annihilation' | 'deity' | 'demigod' | 'half-mortal' | 'claude';

export interface BossPhase {
    /** 1..5, in the order she is fought. */
    id: number;
    name: BossPhaseName;
    /** Health for this phase, as a multiple of the authored HP. */
    hpScale: number;
    /** Movement speed multiple. */
    moveScale: number;
    /** Damage multiple for every attack she uses in this phase. */
    damageScale: number;
    /** Breathing room after each attack, in ms. Shortest at phase 2, on purpose. */
    gapMs: number;
    /** Only 神·Claude calls down 天谴轰炸. */
    allowsWrath: boolean;
    /**
     * How tall she is drawn in this phase, in screen pixels.
     *
     * The owner's ladder: full size for the first three forms, one notch down at phase
     * four (186px), and back to the player's own 173px for the last one. Height is the
     * number he thinks in - the sprite scale follows from her cell size.
     */
    spritePx: number;
}

/**
 * The ladder. Phase 2 is deliberately the hardest: 150% stats AND a one-second gap.
 * From there it unwinds — the last phase is the slowest and least aggressive of all,
 * because by then it is an ending, not a gauntlet.
 */
export const BOSS_PHASES: readonly BossPhase[] = [
    {
        id: 1,
        name: 'annihilation',
        hpScale: 1,
        moveScale: 1,
        damageScale: 1,
        gapMs: 1500,
        allowsWrath: false,
        spritePx: 198,
    },
    {
        id: 2,
        name: 'deity',
        hpScale: 1.5,
        moveScale: 1.5,
        damageScale: 1.5,
        gapMs: 1000,
        allowsWrath: true,
        spritePx: 198,
    },
    {
        id: 3,
        name: 'demigod',
        hpScale: 0.8,
        moveScale: 0.8,
        damageScale: 0.8,
        gapMs: 2000,
        allowsWrath: false,
        spritePx: 198,
    },
    {
        id: 4,
        name: 'half-mortal',
        hpScale: 0.5,
        moveScale: 0.5,
        damageScale: 0.5,
        gapMs: 2000,
        allowsWrath: false,
        spritePx: 186,
    },
    {
        id: 5,
        name: 'claude',
        hpScale: 0.5,
        moveScale: 0.5,
        damageScale: 0.5,
        gapMs: 5000,
        allowsWrath: false,
        spritePx: 173,
    },
] as const;

/** Clamp into the ladder, so a corrupt counter can never index off the end. */
export function phaseAt(index: number): BossPhase {
    const clamped = Math.min(Math.max(Math.floor(index), 0), BOSS_PHASES.length - 1);
    return BOSS_PHASES[clamped];
}

/** The phase after this one, or null when the fight is over. */
export function nextPhase(index: number): BossPhase | null {
    return index + 1 < BOSS_PHASES.length ? BOSS_PHASES[index + 1] : null;
}

/** Everything a phase scales, applied to the authored numbers. */
export interface BossStats {
    hp: number;
    moveSpeed: number;
    damage: number;
}

export function scaleForPhase(base: BossStats, phase: BossPhase): BossStats {
    return {
        // Health is rounded up: a half-phase must never round to 0 HP.
        hp: Math.max(1, Math.ceil(base.hp * phase.hpScale)),
        moveSpeed: base.moveSpeed * phase.moveScale,
        damage: Math.max(1, Math.round(base.damage * phase.damageScale)),
    };
}

/**
 * Wrath bomb count for a phase: 3 circles, or 5 once she is at or below half health.
 *
 * Only 神·Claude calls it at all, so every other phase answers 0 regardless of health.
 */
export function wrathCircleCount(phase: BossPhase, hpFraction: number): number {
    if (!phase.allowsWrath) return 0;
    return hpFraction <= 0.5 ? 5 : 3;
}

/**
 * Which attacks a phase may use, by id.
 *
 * The design table lists four attacks and gates exactly one of them: `④` 天谴轰炸 is
 * 神·Claude's alone. The other three are hers in every phase — the descent changes how
 * hard and how often she swings, not what she knows how to do.
 */
export type BossAttackId = 'triple-cannon' | 'melee' | 'barrage' | 'wrath';

export function attacksForPhase(phase: BossPhase): BossAttackId[] {
    const attacks: BossAttackId[] = ['triple-cannon', 'melee', 'barrage'];
    if (phase.allowsWrath) attacks.push('wrath');
    return attacks;
}

/**
 * Pick the next attack, honouring the owner's anti-frustration rules:
 *
 *   1. never the same attack twice in a row;
 *   2. `③` barrage and `④` wrath never overlap — which here means: after a barrage,
 *      never wrath; after wrath, never a barrage.
 *
 * `random` is injected so the choice is testable without stubbing Math.random.
 */
export function pickNextAttack(
    phase: BossPhase,
    previous: BossAttackId | null,
    random: () => number,
): BossAttackId {
    const pool = attacksForPhase(phase).filter((attack) => {
        if (attack === previous) return false;
        const crossesBarrageWrath =
            (attack === 'wrath' && previous === 'barrage') ||
            (attack === 'barrage' && previous === 'wrath');
        return !crossesBarrageWrath;
    });

    // A phase with one attack would otherwise deadlock on rule 1.
    const effective = pool.length > 0 ? pool : attacksForPhase(phase);
    const index = Math.min(Math.floor(random() * effective.length), effective.length - 1);
    return effective[index];
}

/**
 * The entropy ramp: every wrath wave multiplies the explosion radius by 1.05, and the
 * growth RESETS per phase — the doc is explicit that each phase starts clean, so a
 * long phase 2 cannot make phase 3 impossible before it begins.
 */
export const ENTROPY_GROWTH_PER_WAVE = 1.05;

export function entropyRadius(baseRadius: number, waves: number): number {
    return baseRadius * Math.pow(ENTROPY_GROWTH_PER_WAVE, Math.max(0, Math.floor(waves)));
}
// ─── The health lock ─────────────────────────────────────────────────────
//
// Bosses are where a modified number hurts most: a save edited, a weapon tuning
// pass, a debug key, and the five-phase descent becomes a one-frame death. So a
// single hit may never take more than this fraction of the CURRENT phase's health,
// which turns "instantly dead" into "at least ten hits" no matter what the numbers
// upstream say.

export const BOSS_MAX_HIT_FRACTION = 0.1;

/**
 * Cap one hit against a phase's health pool.
 *
 * The cap is a fraction of the phase maximum, not of what is left, so a nearly-dead
 * boss still dies to a normal hit instead of becoming immortal at 1 HP.
 */
export function clampBossDamage(damage: number, phaseMaxHp: number): number {
    const cap = Math.max(1, Math.ceil(phaseMaxHp * BOSS_MAX_HIT_FRACTION));
    return Math.min(Math.max(0, damage), cap);
}

/**
 * Apply a hit, with the lock in force.
 *
 * Returns the new HP and whether this killed her FOR THIS PHASE - the caller then
 * either advances the ladder or ends the fight.
 */
export function applyBossHit(
    hp: number,
    damage: number,
    phaseMaxHp: number,
): { hp: number; died: boolean } {
    const taken = clampBossDamage(damage, phaseMaxHp);
    const left = Math.max(0, hp - taken);
    return { hp: left, died: left <= 0 };
}

/** On-screen sprite height for a phase, in px. */
export function spriteHeightForPhase(phase: BossPhase): number {
    return phase.spritePx;
}
