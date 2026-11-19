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

/**
 * Interactable action: the steel bowl baked into the warhammer alley (block 4).
 *
 * Reads back 「碗底刻着两个字：白米饭。」 - the code word 第七世 asked for, delivered by the
 * world instead of by a settlement caption.
 */
export const RICE_BOWL_ACTION = 'rice-bowl';

/**
 * 走进铁盆给的那个道具。
 *
 * 主人：`背包里立刻多一个道具【deepseek的大白饭饭盆】介绍为敬请期待（未至之境关键道具）`。
 */
export const RICE_BOWL_DROP_ID = 'rice-bowl-basin';
