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

/**
 * How many rounds one ammo pickup is worth: `fraction` of a magazine, at least one round.
 *
 * The floor matters. `Math.round(clipSize * 0.3)` is 0 for a one- or two-round magazine, so a
 * box the player spent a bag slot on did nothing at all - exactly the "second box added
 * nothing" report. A pickup must always be worth something.
 */
export function refillReserveAmount(clipSize: number, fraction: number): number {
    const clip = Math.max(1, Math.floor(clipSize));
    const f = Number.isFinite(fraction) && fraction > 0 ? fraction : 0;
    return Math.max(1, Math.round(clip * f));
}

/**
 * The reserve after one ammo pickup, capped by the cap that belongs to THIS weapon level.
 *
 * Passing no level (the shape the first version had) capped every weapon at the level-0
 * capacity, so an upgraded weapon's reserve could never be filled past two magazines.
 */
export function refillReserve(
    reserve: number,
    clipSize: number,
    fraction: number,
    level = 0,
): number {
    const cap = reserveMaxFor(clipSize, level);
    return addReserve(reserve, refillReserveAmount(clipSize, fraction), cap);
}

/** A slot that actually spends rounds. Melee weapons carry a `reserve` field nobody reads. */
export function isRangedSlot(spec: {
    bullet?: { type?: string };
    hitWidth?: number;
}): boolean {
    return spec.bullet?.type !== 'melee' && spec.hitWidth === undefined;
}

/**
 * Which hotbar slot an ammo pickup should refill.
 *
 * The active slot when it can fire, otherwise the first slot that can. Returns -1 when she
 * carries nothing ranged, so the caller can skip instead of writing into a sword's dead field.
 */
export function pickRefillTargetIndex(
    slots: readonly { spec: { bullet?: { type?: string }; hitWidth?: number } }[],
    activeIndex: number,
): number {
    if (slots.length === 0) return -1;
    const active = slots[activeIndex];
    if (active && isRangedSlot(active.spec)) return activeIndex;
    return slots.findIndex((slot) => isRangedSlot(slot.spec));
}

/**
 * Reserve capacity for a whole weapon, honouring its upgrade level.
 *
 * `reserveMaxFor(clipSize)` alone is the level-0 capacity, and five places in the weapon
 * controller called it that way. The visible bug: a gun upgraded to 35/140 came back from the
 * next scene as 35/70, because the constructor clamped the saved reserve against the level-0
 * cap. One helper so the level cannot be forgotten at one site and not another.
 */
export function reserveCapFor(
    spec: { clipSize?: number; bullet?: { type?: string }; hitWidth?: number },
    level = 0,
): number {
    const melee = spec.bullet?.type === 'melee' || spec.hitWidth !== undefined;
    if (melee) return 0;
    return reserveMaxFor(spec.clipSize ?? 1, level);
}
