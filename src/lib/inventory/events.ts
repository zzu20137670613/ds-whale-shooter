/**
 * src/lib/inventory/events.ts
 * --------------------------------------------------------------------------
 * React (the backpack overlay) and the Phaser scene talk over the event bus, the
 * same way the shop already asks the character to restore vitals.
 */

/** Payload: `{ index }` - the backpack slot the player clicked. */
export const INVENTORY_USE_EVENT = 'inventory:use';

/**
 * A character says a line above her head.
 *
 * Payload: `{ text, durationMs? }`. The scene owns the rendering, so a module that has no
 * scene access (the drop controller) can still make someone talk - this is what the Gemini
 * juice easter egg uses.
 */
export const CHARACTER_SAY_EVENT = 'character:say';
