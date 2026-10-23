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
export const SHOP_RESTORE_VITALS_PRICE = 60;

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
