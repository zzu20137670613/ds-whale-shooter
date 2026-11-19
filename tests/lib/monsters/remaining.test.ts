/**
 * tests/lib/monsters/remaining.test.ts
 * --------------------------------------------------------------------------
 * What "剩余怪物数" counts.
 *
 * The owner wants it to move as monsters die. Two decisions keep it honest:
 *   - a DYING monster is already beaten, so it must not still be counted (otherwise the last
 *     kill looks like it did not register);
 *   - a wave that is queued but not placed yet still belongs to the map (otherwise the HUD
 *     shows 0 for two seconds while nine monsters materialise).
 */

import { describe, expect, it } from 'vitest';

import { MONSTERS_REMAINING_EVENT, remainingCount, remainingWithPending } from '@/lib/monsters/remaining';

describe('remainingCount', () => {
    it('counts what is still standing', () => {
        const monsters = [
            { dead: false, state: 'chase' },
            { dead: false, state: 'attack' },
            { dead: false, state: 'idle' },
        ];
        expect(remainingCount(monsters)).toBe(3);
    });

    it('does not count the dead', () => {
        expect(remainingCount([{ dead: true, state: 'chase' }])).toBe(0);
    });

    it('does not count a monster in its death animation', () => {
        expect(remainingCount([{ dead: false, state: 'dying' }])).toBe(0);
    });

    it('does not count scenery that happens to be shootable', () => {
        expect(remainingCount([{ dead: false, state: 'idle', spec: { prop: true } }])).toBe(0);
    });

    it('copes with an empty map', () => {
        expect(remainingCount([])).toBe(0);
    });
});

describe('remainingWithPending', () => {
    it('adds the wave that has been queued but not placed', () => {
        expect(remainingWithPending(3, 9)).toBe(12);
    });

    it('never goes negative on a bad reading', () => {
        expect(remainingWithPending(0, -5)).toBe(0);
        expect(remainingWithPending(-2, 0)).toBe(0);
    });
});

describe('the event name', () => {
    it('is namespaced so the HUD and the controller cannot drift', () => {
        expect(MONSTERS_REMAINING_EVENT).toBe('monsters:remaining');
    });
});