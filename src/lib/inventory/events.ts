/**
 * src/lib/inventory/events.ts
 * --------------------------------------------------------------------------
 * React (the backpack overlay) and the Phaser scene talk over the event bus, the
 * same way the shop already asks the character to restore vitals.
 */

/** Payload: `{ index }` - the backpack slot the player clicked. */
export const INVENTORY_USE_EVENT = 'inventory:use';
