/**
 * Weapon range grows with the ladder: +10% per level, ranged only.
 *
 * Why this exists: the boss fights are designed around kiting at range, and a
 * weapon whose reach never moves means the hardest fight in the game is fought with
 * starting-distance coverage. Five levels = +50% reach, which is felt without
 * changing the weapon's identity (a shotgun does not become a sniper).
 *
 * Melee is deliberately excluded: `range` on a melee weapon positions the swing
 * hitbox, so growing it would silently grow the hitbox and turn a sword into a
 * polearm.
 */

import { WEAPON_RANGE_PER_LEVEL } from '@/lib/constants';

/** Is this spec a projectile weapon (the ones that get extra reach)? */
export function isRangedWeapon(spec: { projectile?: unknown; hitWidth?: number }): boolean {
    return spec.projectile !== undefined;
}

/**
 * Range at a given upgrade level. Compounded, not additive - the same shape the
 * damage ladder uses, so "level 5" means the same thing on both axes.
 *
 *     level 0..5 -> x1.00, x1.10, x1.21, x1.33, x1.46, x1.61
 */
export function rangeAtLevel(baseRange: number, level: number): number {
    const base = Number.isFinite(baseRange) ? baseRange : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    return base * Math.pow(1 + WEAPON_RANGE_PER_LEVEL, steps);
}