/**
 * tests/lib/levels/cat-gift.test.ts
 * --------------------------------------------------------------------------
 * The cabin cat's rifle, exercised instead of hoped for.
 *
 * The owner reported this three times. Each fix tested the data around it (prefetch,
 * weapon loading) and never the act of handing it over, so a broken gift could still ship
 * with every suite green.
 */

import { describe, expect, it, vi } from 'vitest';

import { CAT_GIFT_WEAPON_ID, giveCatGift, type CatGiftDeps } from '@/lib/levels/cat-gift';
import type { WeaponSpec } from '@/lib/weapons';

const rifle = { id: CAT_GIFT_WEAPON_ID } as unknown as WeaponSpec;

function deps(overrides: Partial<CatGiftDeps> = {}): CatGiftDeps {
    let slots = 2;
    return {
        weaponsById: new Map([[CAT_GIFT_WEAPON_ID, rifle]]),
        weapons: { getSlotCount: () => slots },
        pickUp: vi.fn(() => {
            slots += 1;
            return true;
        }),
        refresh: vi.fn(),
        warn: vi.fn(),
        ...overrides,
    };
}

describe('giveCatGift', () => {
    it('picks the rifle up and repaints the HUD', () => {
        const d = deps();
        expect(giveCatGift(d)).toBe('granted');
        expect(d.pickUp).toHaveBeenCalledWith(CAT_GIFT_WEAPON_ID);
        expect(d.refresh).toHaveBeenCalledTimes(1);
        expect(d.warn).not.toHaveBeenCalled();
    });

    it('refuses loudly when the scene never loaded the rifle', () => {
        const d = deps({ weaponsById: new Map() });
        expect(giveCatGift(d)).toBe('spec-missing');
        expect(d.pickUp).not.toHaveBeenCalled();
        expect(d.warn).toHaveBeenCalled();
    });

    it('reports a full hotbar instead of pretending it worked', () => {
        const d = deps({
            weapons: { getSlotCount: () => 2 },
            pickUp: vi.fn(() => false), // slot count stays 2
        });
        expect(giveCatGift(d)).toBe('not-added');
        expect(d.warn).toHaveBeenCalled();
    });

    it('survives the tavern placeholder, which has no weapons module', () => {
        const d = deps({ weapons: null });
        expect(giveCatGift(d)).toBe('granted');
        expect(d.pickUp).toHaveBeenCalled();
    });
});