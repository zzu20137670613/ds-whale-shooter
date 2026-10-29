/**
 * src/lib/levels/easter-eggs.ts
 * --------------------------------------------------------------------------
 * The two ids the cabin cat needs, in one place.
 *
 * The gift used to be looked up from the level's preloaded drop specs, and the cabin
 * never listed `weapon-drop` anywhere else - so the spec was missing at click time and
 * the rifle silently did not appear (a `console.warn` nobody reads). Naming the ids
 * here lets `collectDropIds` pull them in for any level that carries the cat.
 */

/** The drop entity the gift launches. */
export const CAT_SHOP_GIFT_DROP_ID = 'weapon-drop';

/** The weapon it hands over. */
export const CAT_SHOP_GIFT_WEAPON_ID = 'assault-rifle';

/** Interactable action that opens the cat's shop. */
export const CAT_SHOP_ACTION = 'cat-shop';