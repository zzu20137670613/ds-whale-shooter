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
export function canAffordRestore(money: number, price = SHOP_RESTORE_VITALS_PRICE): boolean {
    return money >= price;
}

/**
 * Both conditions the shop row needs.
 *
 * `price` defaults to the flat base price, but the row is sold at the armour ladder's price
 * (5 / 10 / … / 160). Without passing it the gate said "affordable" at 5 coins while the
 * click actually asked for 160, so the button did nothing at all - no refill, no charge.
 */
export function canBuyRestore(
    v: Vitals & { money: number },
    price = SHOP_RESTORE_VITALS_PRICE,
): boolean {
    return !isVitalsFull(v) && canAffordRestore(v.money, price);
}

/**
 * The vitals a paid refill produces: both pools at their maxima.
 *
 * Pure so the shop panel, the character and the tests all agree on what "补满状态" means.
 */
export function restoredVitals(v: Vitals): Vitals {
    return { hp: v.maxHp, sp: v.maxSp, maxHp: v.maxHp, maxSp: v.maxSp };
}
