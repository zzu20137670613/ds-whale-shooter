/**
 * src/lib/weapons/ammo.ts
 * --------------------------------------------------------------------------
 * Reserve ammunition: the second number on the weapon card.
 *
 * The card used to print `ammo / clipSize`, so the right-hand number was the
 * magazine size - a constant. It read exactly like a reserve pool that never
 * moved ("现在其实算是无限子弹"), and in a real sense it was: a reload refilled
 * the magazine out of nowhere.
 *
 * These helpers make the reserve real. They are pure so the awkward cases are
 * testable: reloading with a partly empty reserve, a reserve that cannot cover
 * a full magazine, and the dry-fire state where both are zero.
 */

import { AMMO_RESERVE_BASE_CLIPS, AMMO_RESERVE_CLIPS_PER_LEVEL } from '@/lib/constants';

/**
 * Capacity of a weapon's reserve pool: `clipSize * (2 + level)`.
 *
 * Melee weapons pass a clip size of 0 and get 0. `level` is that weapon's own
 * upgrade level, clamped at 0 so a malformed save can only ever shrink nothing.
 */
export function reserveMaxFor(clipSize: number, level = 0): number {
    const clip = Math.max(0, Math.floor(clipSize));
    const steps = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    const clips = AMMO_RESERVE_BASE_CLIPS + steps * AMMO_RESERVE_CLIPS_PER_LEVEL;
    return clip * clips;
}

/** Whether a reload would actually move rounds right now. */
export function canReloadFromReserve(ammo: number, reserve: number, clipSize: number): boolean {
    return reserve > 0 && ammo < clipSize;
}

/**
 * Move rounds from the reserve into the magazine, capped by the magazine's
 * free space. Returns what changed, so the caller never has to recompute.
 *
 * A reserve that cannot fill the magazine is legal: the magazine comes back
 * partly loaded and the player can reload again later.
 */
export function reloadFromReserve(
    ammo: number,
    reserve: number,
    clipSize: number,
): { ammo: number; reserve: number; took: number } {
    const free = Math.max(0, clipSize - ammo);
    const took = Math.min(free, Math.max(0, reserve));
    return { ammo: ammo + took, reserve: reserve - took, took };
}

/** Top the reserve up, never past its cap. */
export function addReserve(reserve: number, amount: number, reserveMax: number): number {
    return Math.min(reserveMax, Math.max(0, reserve) + Math.max(0, Math.floor(amount)));
}
