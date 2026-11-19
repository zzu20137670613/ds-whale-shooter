/**
 * tests/lib/story/seed-shop.test.ts
 * --------------------------------------------------------------------------
 * seed's four doors.
 *
 * The owner dictated the order and the wording; the level ids are the part that has to be
 * right or a button teleports into nowhere.
 */

import { describe, expect, it } from 'vitest';

import { SEED_DESTINATIONS, destinationIsOpen, epilogueIsOpen } from '@/lib/story/seed-shop';

describe('the doors, in his order', () => {
    it('has exactly four', () => {
        expect(SEED_DESTINATIONS).toHaveLength(4);
    });

    it('lists library, sky city, atlantis, unreached', () => {
        expect(SEED_DESTINATIONS.map((d) => d.id)).toEqual([
            'starry-library',
            'sky-city',
            'atlantis',
            'unknown-realm',
        ]);
    });

    it('points the first three at real level ids', () => {
        expect(SEED_DESTINATIONS[0].levelId).toBe('starry-library-1-entrance');
        expect(SEED_DESTINATIONS[1].levelId).toBe('gpt-sky-city-1-entrance');
        expect(SEED_DESTINATIONS[2].levelId).toBe('dsh-atlantis-1-entrance');
    });

    it('leaves 未至之境 without a destination on purpose', () => {
        const unreached = SEED_DESTINATIONS[3];
        expect(unreached.levelId).toBeNull();
        expect(destinationIsOpen(unreached)).toBe(false);
    });

    it('paints only 未至之境 in rainbow', () => {
        const rainbowIds = SEED_DESTINATIONS.filter((d) => d.rainbow).map((d) => d.id);
        expect(rainbowIds).toEqual(['unknown-realm']);
    });

    it('gives every row its own locale suffix', () => {
        // The panel resolves these as `t(`seedShop.${label}`)`.
        const labels = SEED_DESTINATIONS.map((d) => d.label);
        expect(new Set(labels).size).toBe(labels.length);
        expect(labels).toEqual(['starryLibrary', 'skyCity', 'atlantis', 'unknownRealm']);
    });
});

describe('opening the doors', () => {
    it('treats the three known levels as open', () => {
        expect(SEED_DESTINATIONS.slice(0, 3).every(destinationIsOpen)).toBe(true);
    });
});

describe('the epilogue gate', () => {
    it('stays shut until the story is finished', () => {
        expect(epilogueIsOpen(false)).toBe(false);
        expect(epilogueIsOpen(true)).toBe(true);
    });
});
