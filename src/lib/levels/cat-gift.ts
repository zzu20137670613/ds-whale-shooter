/**
 * src/lib/levels/cat-gift.ts
 * --------------------------------------------------------------------------
 * The cabin cat's rifle, as a function that can be tested.
 *
 * Three rounds of "the cat gave me nothing" ended here. The last one was the cause: the
 * scene called `pickUpWeapon`, which only *switches to* a weapon already in the hotbar
 * ("no-op if not present"). The rifle was never in her hotbar, so the call did nothing,
 * the slot count never changed, and the gift looked like a dead cat.
 *
 * `tryPickupWeaponById` is the call that actually adds a weapon, and it reports
 * 'added' / 'capped' / 'unknown' instead of a bare boolean - which is what lets the HUD say
 * "your hands are full" instead of staying silent.
 */

import type { WeaponSpec } from '@/lib/weapons';

/** What the cabin cat hands over. */
export const CAT_GIFT_WEAPON_ID = 'assault-rifle';

export type PickupOutcome = 'added' | 'capped' | 'unknown';

export interface CatGiftDeps {
    /** Every weapon the current scene loaded. */
    weaponsById: ReadonlyMap<string, WeaponSpec>;
    /** `character.tryPickupWeaponById` - adds the weapon to the next empty slot. */
    addWeapon: (weaponId: string) => PickupOutcome;
    /** Push HP / SP / ammo into the HUD; a no-op on the placeholder. */
    refresh: () => void;
    /** Reports a real failure; the gift is silent no more. */
    warn: (message: string, detail: unknown) => void;
}

export type CatGiftResult = 'granted' | 'capped' | 'unknown';

/**
 * Hand the rifle over.
 *
 * Returns what happened so the caller can say it out loud, and so a test can tell
 * "it landed in her hands" from "her hands were full" without watching a screen.
 */
export function giveCatGift(deps: CatGiftDeps): CatGiftResult {
    if (!deps.weaponsById.has(CAT_GIFT_WEAPON_ID)) {
        deps.warn('the rifle spec is not loaded in this scene', {
            giftId: CAT_GIFT_WEAPON_ID,
            loaded: [...deps.weaponsById.keys()],
        });
        return 'unknown';
    }

    const outcome = deps.addWeapon(CAT_GIFT_WEAPON_ID);
    deps.refresh();

    if (outcome === 'added') return 'granted';
    if (outcome === 'capped') {
        deps.warn('hotbar full, the rifle did not fit', { giftId: CAT_GIFT_WEAPON_ID });
        return 'capped';
    }
    deps.warn('the character refused the rifle', { giftId: CAT_GIFT_WEAPON_ID, outcome });
    return 'unknown';
}