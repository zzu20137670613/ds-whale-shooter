/**
 * tests/lib/levels/cat-gift.test.ts
 * --------------------------------------------------------------------------
 * The cabin cat's rifle, exercised instead of hoped for.
 *
 * The owner reported this three times. Each earlier fix tested the data around it (prefetch,
 * weapon loading) and never the act of handing it over - so the scene could call
 * `pickUpWeapon` (which only *switches to* a weapon she already carries) and still ship with
 * every suite green.
 */

import { describe, expect, it, vi } from 'vitest';

import { CAT_GIFT_WEAPON_ID, giveCatGift, type CatGiftDeps } from '@/lib/levels/cat-gift';
import type { WeaponSpec } from '@/lib/weapons';

const rifle = { id: CAT_GIFT_WEAPON_ID } as unknown as WeaponSpec;

function deps(overrides: Partial<CatGiftDeps> = {}): CatGiftDeps {
    return {
        weaponsById: new Map([[CAT_GIFT_WEAPON_ID, rifle]]),
        addWeapon: vi.fn(() => 'added' as const),
        refresh: vi.fn(),
        warn: vi.fn(),
        ...overrides,
    };
}

describe('giveCatGift', () => {
    it('adds the rifle to her hands and repaints the HUD', () => {
        const d = deps();
        expect(giveCatGift(d)).toBe('granted');
        expect(d.addWeapon).toHaveBeenCalledWith(CAT_GIFT_WEAPON_ID);
        expect(d.refresh).toHaveBeenCalledTimes(1);
        expect(d.warn).not.toHaveBeenCalled();
    });

    it('refuses loudly when the scene never loaded the rifle', () => {
        const d = deps({ weaponsById: new Map() });
        expect(giveCatGift(d)).toBe('unknown');
        expect(d.addWeapon).not.toHaveBeenCalled();
        expect(d.warn).toHaveBeenCalled();
    });

    it('reports a full hotbar instead of pretending it worked', () => {
        const d = deps({ addWeapon: vi.fn(() => 'capped' as const) });
        expect(giveCatGift(d)).toBe('capped');
        expect(d.warn).toHaveBeenCalled();
    });

    it('treats an unknown weapon id from the character as a failure', () => {
        const d = deps({ addWeapon: vi.fn(() => 'unknown' as const) });
        expect(giveCatGift(d)).toBe('unknown');
        expect(d.warn).toHaveBeenCalled();
    });

    it('still refreshes the HUD on the failure paths', () => {
        // A capped hotbar should at least show the truth, not a stale panel.
        const d = deps({ addWeapon: vi.fn(() => 'capped' as const) });
        giveCatGift(d);
        expect(d.refresh).toHaveBeenCalledTimes(1);
    });
});

describe('the gift she already carries', () => {
    it('reports a merge instead of a duplicate rifle', () => {
        // Gemini's hotbar already holds the assault rifle, so the cat's gift used to leave
        // her carrying two of them. Adding must fuse them (+1 level) instead.
        const d = deps({ addWeapon: vi.fn(() => 'merged' as const) });
        expect(giveCatGift(d)).toBe('merged');
        expect(d.warn).not.toHaveBeenCalled();
    });
});
