/**
 * src/lib/characters/vitals.ts
 * --------------------------------------------------------------------------
 * HP / SP are not self-healing by design: the only ways back up are pickups on
 * the ground and a paid refill in the merchant's shop. This module owns the
 * rules both sides share — the panel that sells it and the character that
 * receives it — so the price and the "already full" test cannot drift apart.
 */

/** Event the shop fires after a successful purchase. */
export const SHOP_RESTORE_VITALS_EVENT = 'shop:restore-vitals';

/**
 * Price of a full HP + SP refill, in the same currency as kills and upgrades.
 *
 * Deliberately cheaper than a mid-tier upgrade and dearer than one kill: a
 * full refill should be a real decision, not the default way to survive.
 */
export const SHOP_RESTORE_VITALS_PRICE = 5;

/**
 * Price by armour level (0..5): 5 / 10 / 20 / 40 / 80 / 160.
 *
 * The refill is worth more once the pools it fills are bigger, so it is priced off
 * the ladder that grew them. Level 0 costs a handful of coins - early on, being
 * nearly dead should not price you out of playing.
 */
export const VITALS_RESTORE_PRICES = [5, 10, 20, 40, 80, 160] as const;

/** Refill price for a given armour level, clamped to the table. */
export function vitalsRestorePrice(armorLevel: number | undefined): number {
    const level = Number.isFinite(armorLevel) ? Math.floor(armorLevel as number) : 0;
    const index = Math.max(0, Math.min(VITALS_RESTORE_PRICES.length - 1, level));
    return VITALS_RESTORE_PRICES[index];
}

export interface Vitals {
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;
}

/** Nothing to sell once both pools are already topped up. */
export function isVitalsFull(v: Vitals): boolean {
    return v.hp >= v.maxHp && v.sp >= v.maxSp;
}

/** Does the wallet cover the refill? */
export function canAffordRestore(money: number): boolean {
    return money >= SHOP_RESTORE_VITALS_PRICE;
}

/** Both conditions the shop row needs. */
export function canBuyRestore(v: Vitals & { money: number }): boolean {
    return !isVitalsFull(v) && canAffordRestore(v.money);
}
