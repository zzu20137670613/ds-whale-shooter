/**
 * tests/lib/monsters/lost.test.ts
 * --------------------------------------------------------------------------
 * A monster that is not on the map must not hold the level hostage.
 *
 * The owner, in the sky city: `3波打完了，但是没出传送阵，找了全图没有怪了`. The exit portal
 * (and the merchant) only open when `isAllCleared()` is true, and that counts every living
 * monster - including one that was spawned onto a floating platform's edge, fell through, or
 * is wedged inside a wall where the player can never reach or even see it.
 *
 * These two predicates are the watchdog's decision: outside the painted world, or left behind
 * long after the fight moved on.
 */

import { describe, expect, it } from 'vitest';

import { isAbandoned, isOutsideWorld } from '@/lib/monsters/lost';

const WORLD = { width: 11008, height: 6144 };

describe('isOutsideWorld', () => {
    it('accepts a point on the map', () => {
        expect(isOutsideWorld({ x: 5000, y: 3000 }, WORLD)).toBe(false);
        expect(isOutsideWorld({ x: 0, y: 0 }, WORLD)).toBe(false);
        expect(isOutsideWorld({ x: WORLD.width, y: WORLD.height }, WORLD)).toBe(false);
    });

    it('rejects a point past the edge, where no floor exists', () => {
        // The default margin is 64px of overhang, so a point must be well past it.
        expect(isOutsideWorld({ x: -80, y: 3000 }, WORLD)).toBe(true);
        expect(isOutsideWorld({ x: 3000, y: WORLD.height + 80 }, WORLD)).toBe(true);
        expect(isOutsideWorld({ x: WORLD.width + 80, y: 10 }, WORLD)).toBe(true);
    });

    it('allows a small margin so a body straddling the edge is not culled', () => {
        // Half a body hanging over the border is normal while pathing.
        expect(isOutsideWorld({ x: -40, y: 3000 }, WORLD, 64)).toBe(false);
        expect(isOutsideWorld({ x: -120, y: 3000 }, WORLD, 64)).toBe(true);
    });
});

describe('isAbandoned', () => {
    it('is false while the fight is still nearby', () => {
        expect(isAbandoned(400, 60_000)).toBe(false);
        expect(isAbandoned(2_000, 60_000)).toBe(false);
    });

    it('is false for a far monster that has only just been left behind', () => {
        expect(isAbandoned(9_000, 5_000)).toBe(false);
    });

    it('is true for a far monster nobody has been near for a long time', () => {
        expect(isAbandoned(9_000, 60_000)).toBe(true);
        expect(isAbandoned(4_000, 60_000)).toBe(true);
    });

    it('is not fooled by a monster standing still next to the player', () => {
        expect(isAbandoned(100, 600_000)).toBe(false);
    });
});