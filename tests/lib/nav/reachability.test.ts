/**
 * tests/lib/nav/reachability.test.ts
 * --------------------------------------------------------------------------
 * Reachability matters for follow-spawn: a cell can be wall-free and still be
 * impossible to stand in, because the only way in is through a wall. A monster
 * dropped in a sealed room walks into the wall forever.
 */

import { describe, expect, it } from 'vitest';

import { buildReachability, isReachable, nearestReachable } from '@/lib/nav/reachability';

/** 0 = walkable, 1 = wall. */
const grid = (rows: string[]) => rows.map((row) => [...row].map((c) => (c === '#' ? 1 : 0)));

describe('buildReachability', () => {
    const open = grid([
        '.....',
        '.....',
        '.....',
        '.....',
        '.....',
    ]);

    it('reaches every cell of an open map', () => {
        const mask = buildReachability(open, 1, 1);
        expect(mask).not.toBeNull();
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                expect(isReachable(mask!, x, y, 5)).toBe(true);
            }
        }
    });

    it('cannot step onto a wall', () => {
        const mask = buildReachability(open, 1, 1);
        expect(isReachable(mask!, 1, 1, 5)).toBe(true);
        const walled = grid(['.....', '.###.', '.###.', '.###.', '.....']);
        const inside = buildReachability(walled, 0, 0);
        expect(isReachable(inside!, 2, 2, 5)).toBe(false);
    });

    it('does not reach a sealed room', () => {
        const sealed = grid([
            '.....',
            '.###.',
            '.#.#.',
            '.###.',
            '.....',
        ]);
        const mask = buildReachability(sealed, 0, 0)!;
        // (2,2) is the empty cell inside the box, walled off on all sides.
        expect(isReachable(mask, 2, 2, 5)).toBe(false);
        expect(isReachable(mask, 0, 0, 5)).toBe(true);
    });

    it('does not leak through a diagonal gap that has no floor', () => {
        // Corner-to-corner contact only: a real body cannot squeeze through.
        const pinch = grid([
            '..##',
            '..##',
            '##..',
            '##..',
        ]);
        const mask = buildReachability(pinch, 0, 0)!;
        expect(isReachable(mask, 2, 2, 4)).toBe(false);
    });

    it('starts from the nearest walkable cell when the origin is a wall', () => {
        const blocked = grid([
            '##...',
            '#....',
            '.....',
        ]);
        const mask = buildReachability(blocked, 0, 0);
        expect(mask).not.toBeNull();
        expect(isReachable(mask!, 2, 0, 5)).toBe(true);
    });

    it('returns null when the whole map is wall', () => {
        expect(buildReachability(grid(['###', '###']), 0, 0)).toBeNull();
    });
});

describe('nearestReachable', () => {
    const sealed = grid([
        '.....',
        '.###.',
        '.#.#.',
        '.###.',
        '.....',
    ]);

    it('walks out to an open cell when the target is sealed in', () => {
        const mask = buildReachability(sealed, 0, 0)!;
        const found = nearestReachable(mask, 2, 2, 5, 5, 4);
        expect(found).not.toBeNull();
        // Whatever it picks must actually be reachable, and it must be on the
        // first ring outside the sealed box (any of the four exits qualifies).
        expect(isReachable(mask, found!.x, found!.y, 5)).toBe(true);
        expect(Math.max(Math.abs(found!.x - 2), Math.abs(found!.y - 2))).toBe(2);
    });

    it('returns the cell itself when it is already reachable', () => {
        const mask = buildReachability(sealed, 0, 0)!;
        expect(nearestReachable(mask, 1, 0, 5, 5, 4)).toEqual({ x: 1, y: 0 });
    });

    it('gives up when nothing reachable is close enough', () => {
        const mask = buildReachability(sealed, 0, 0)!;
        expect(nearestReachable(mask, 2, 2, 5, 5, 0)).toBeNull();
    });
});