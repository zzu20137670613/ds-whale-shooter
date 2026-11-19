/**
 * src/lib/inventory/index.ts
 * --------------------------------------------------------------------------
 * Public surface of the backpack module.
 */

export {
    INVENTORY_COLUMNS,
    INVENTORY_ROWS,
    INVENTORY_SLOTS,
    INVENTORY_STACK_MAX,
    addToInventory,
    countOf,
    emptyInventory,
    findSlot,
    isPickupPossible,
    removeFromInventory,
} from './inventory';
export type { AddResult, InventorySlot } from './inventory';
export { INVENTORY_USE_EVENT } from './events';

export { bagSellValue, sellListings } from './sell';
export type { SellCatalogEntry, SellListing } from './sell';
