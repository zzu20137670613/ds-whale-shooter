/**
 * src/lib/levels/cat-gift.ts
 * --------------------------------------------------------------------------
 * The cabin cat's rifle, as a function that can be tested.
 *
 * The gift went three rounds without arriving because it lived inside a Phaser scene method
 * with five preconditions, and nothing exercised it. Pulling the decision out means the
 * awkward cases (spec not loaded, hotbar full, already held) are covered by tests instead
 * of by the owner walking to the cat again.
 */

import type { WeaponSpec } from '@/lib/weapons';

/** What the cabin cat hands over. */
export const CAT_GIFT_WEAPON_ID = 'assault-rifle';

export interface CatGiftDeps {
    /** Every weapon the current scene loaded. */
    weaponsById: ReadonlyMap<string, WeaponSpec>;
    /** `null` on the tavern placeholder. */
    weapons: { getSlotCount(): number } | null;
    pickUp: (weaponId: string) => unknown;
    /** Push HP / SP / ammo into the HUD; a no-op on the placeholder. */
    refresh: () => void;
    /** Reports a real failure; the gift is silent no more. */
    warn: (message: string, detail: unknown) => void;
}

export type CatGiftResult = 'granted' | 'spec-missing' | 'not-added';

/**
 * Hand the rifle over.
 *
 * Returns what happened so the caller can log it, and so a test can tell "must pick it up"
 * from "could not" without watching a screen.
 */
export function giveCatGift(deps: CatGiftDeps): CatGiftResult {
    const weapon = deps.weaponsById.get(CAT_GIFT_WEAPON_ID);
    if (!weapon) {
        deps.warn('the rifle spec is not loaded in this scene', {
            giftId: CAT_GIFT_WEAPON_ID,
            loaded: [...deps.weaponsById.keys()],
        });
        return 'spec-missing';
    }

    // No weapons module at all (tavern placeholder): nothing to measure, so trust the
    // pickup call rather than reporting a failure that cannot be verified.
    if (!deps.weapons) {
        deps.pickUp(CAT_GIFT_WEAPON_ID);
        deps.refresh();
        return 'granted';
    }

    const before = deps.weapons.getSlotCount();
    deps.pickUp(CAT_GIFT_WEAPON_ID);
    const after = deps.weapons.getSlotCount();
    deps.refresh();

    if (after === before) {
        // Already carrying it, or the hotbar is full.
        deps.warn('rifle not added (already held, or hotbar full)', { before, after });
        return 'not-added';
    }
    return 'granted';
}