/**
 * src/lib/weapons/reload.ts
 * --------------------------------------------------------------------------
 * Reload time shrinks with the ladder: -10% per level, LINEAR.
 *
 * Linear on purpose, because the owner stated the target as a fact: "满级时比初始
 * 换弹快一倍" - five levels must land on exactly half the base time. Compounding
 * 0.9 five times gives 0.59, which is not "half", so the percentage is subtracted
 * from the base rather than multiplied into it.
 *
 *     level 0..5 -> x1.00, x0.90, x0.80, x0.70, x0.60, x0.50
 */

import { WEAPON_RELOAD_MIN_FACTOR, WEAPON_RELOAD_PER_LEVEL } from '@/lib/constants';

/** Reload time in ms at a given upgrade level. */
export function reloadTimeAtLevel(baseMs: number, level: number): number {
    const base = Number.isFinite(baseMs) ? Math.max(0, baseMs) : 0;
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    // Floor the factor so a future longer ladder cannot reach zero (instant
    // reload would erase the dry-magazine pressure the ammo pool exists for).
    const factor = Math.max(WEAPON_RELOAD_MIN_FACTOR, 1 - steps * WEAPON_RELOAD_PER_LEVEL);
    return Math.max(1, Math.round(base * factor));
}