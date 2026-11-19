/**
 * src/lib/characters/combat.ts
 * --------------------------------------------------------------------------
 * The two numbers that decide how a hit lands: armour, and whether it crits.
 *
 * Armour is FLAT, not a percentage. The owner picked flat because it is easy to
 * reason about, and because a percentage would blunt a boss's big move - he wants
 * to be able to eat a full-power boss ultimate, not shrug it off.
 *
 *     damage taken = max(0, incoming - armour)
 *
 * The floor matters: armour that overflows soaks the hit completely, and the
 * clamp guarantees a hit can never push HP *up*.
 *
 * Crit is `(luck / 10) * COMBAT_CRIT_MULTIPLIER`; the multiplier is 1.0, so luck
 * 10 is a guaranteed crit for double damage.
 */

import { COMBAT_CRIT_DAMAGE_MULTIPLIER, COMBAT_CRIT_MULTIPLIER } from '@/lib/constants';

/** Damage that actually lands after flat armour. Never negative. */
export function damageAfterArmor(incoming: number, armor: number): number {
    const damage = Number.isFinite(incoming) ? Math.max(0, incoming) : 0;
    const soak = Number.isFinite(armor) ? Math.max(0, armor) : 0;
    return Math.max(0, damage - soak);
}

/** Probability of a crit for a given luck value (clamped to 1..10). */
export function critChance(luck: number): number {
    const clamped = Math.max(1, Math.min(10, Math.floor(Number.isFinite(luck) ? luck : 1)));
    return Math.min(1, (clamped / 10) * COMBAT_CRIT_MULTIPLIER);
}

/** Roll one hit. `rng` is injected so tests do not depend on Math.random. */
export function isCriticalHit(luck: number, rng: () => number = Math.random): boolean {
    return rng() < critChance(luck);
}

/** Double a damage number on a crit. */
export function critDamage(damage: number): number {
    return damage * COMBAT_CRIT_DAMAGE_MULTIPLIER;
}