/**
 * src/lib/inventory/sell.ts
 * --------------------------------------------------------------------------
 * Selling bag items back to the shop.
 *
 * A drop is worth `spec.sellPrice` coins per unit; anything without a price (or
 * priced at 0) is not sellable yet, which is how the owner left the four original
 * pickups. Pure functions so the arithmetic is testable without the store.
 */

import type { InventorySlot } from './inventory';

/** What a single kind of item is worth per unit, in coins. */
export interface SellListing {
    dropId: string;
    name: string;
    /** Chinese name, when the drop has one. The shop picks with `pickText`. */
    nameZh?: string;
    /** Units held, across every stack. */
    count: number;
    /** Coins per unit. */
    unitPrice: number;
    /** `count * unitPrice`. */
    total: number;
}

export interface SellCatalogEntry {
    name: string;
    nameZh?: string;
    sellPrice?: number;
}

/**
 * One listing per sellable item held, in the order the items first appear in the
 * bag (so the shop row order matches what the player sees in the backpack).
 */
export function sellListings(
    inventory: readonly InventorySlot[],
    catalog: Record<string, SellCatalogEntry>,
): SellListing[] {
    const order: string[] = [];
    const counts = new Map<string, number>();
    for (const slot of inventory) {
        if (!counts.has(slot.dropId)) order.push(slot.dropId);
        counts.set(slot.dropId, (counts.get(slot.dropId) ?? 0) + slot.count);
    }

    return order
        .map((dropId) => {
            const entry = catalog[dropId];
            const unitPrice = Math.max(0, Math.floor(entry?.sellPrice ?? 0));
            const count = counts.get(dropId) ?? 0;
            return {
                dropId,
                name: entry?.name ?? dropId,
                // Carried through so the shop can print the Chinese name under a Chinese HUD.
                nameZh: entry?.nameZh,
                count,
                unitPrice,
                total: count * unitPrice,
            };
        })
        .filter((listing) => listing.count > 0 && listing.unitPrice > 0);
}

/** Coins the whole bag would fetch. */
export function bagSellValue(
    inventory: readonly InventorySlot[],
    catalog: Record<string, SellCatalogEntry>,
): number {
    return sellListings(inventory, catalog).reduce((sum, listing) => sum + listing.total, 0);
}
