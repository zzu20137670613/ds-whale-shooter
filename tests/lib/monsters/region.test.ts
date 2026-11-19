/**
 * tests/lib/monsters/region.test.ts
 * --------------------------------------------------------------------------
 * Follow-spawn geometry for the three big levels.
 *
 * The owner's spec: the map splits into quadrants at half width / half height;
 * entering one of the first three quadrants spawns a wave of nine - four near the
 * player (on screen, 300-900px out) and five on the quadrant's edges, 200px
 * inside the boundary and spread over all four sides. Composition is fixed:
 * near = 2 melee + 2 ranged, far = 2 melee + 3 ranged.
 */

import { describe, expect, it } from 'vitest';

import {
    edgeSpawnPoints,
    nearRingPoints,
    quadrantIndexAt,
    quadrantRects,
    waveComposition,
} from '@/lib/monsters/region';

const LIBRARY = { width: 11008, height: 6144 };

describe('quadrantRects', () => {
    it('splits the map at half width and half height', () => {
        const rects = quadrantRects(LIBRARY.width, LIBRARY.height);
        expect(rects).toHaveLength(4);
        expect(rects[0]).toEqual({ x: 0, y: 0, width: 5504, height: 3072 });
        expect(rects[1]).toEqual({ x: 5504, y: 0, width: 5504, height: 3072 });
        expect(rects[2]).toEqual({ x: 0, y: 3072, width: 5504, height: 3072 });
        expect(rects[3]).toEqual({ x: 5504, y: 3072, width: 5504, height: 3072 });
    });

    it('covers the whole map with no gaps', () => {
        const rects = quadrantRects(LIBRARY.width, LIBRARY.height);
        const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);
        expect(area).toBe(LIBRARY.width * LIBRARY.height);
    });

    it('rounds odd sizes so the map stays covered', () => {
        const rects = quadrantRects(101, 51);
        expect(rects[0].width + rects[1].width).toBe(101);
        expect(rects[0].height + rects[2].height).toBe(51);
    });
});

describe('quadrantIndexAt', () => {
    const rects = quadrantRects(LIBRARY.width, LIBRARY.height);

    it('finds the quadrant holding a point', () => {
        expect(quadrantIndexAt(100, 100, rects)).toBe(0);
        expect(quadrantIndexAt(6000, 100, rects)).toBe(1);
        expect(quadrantIndexAt(100, 4000, rects)).toBe(2);
        expect(quadrantIndexAt(9000, 5000, rects)).toBe(3);
    });

    it('treats the shared border as the later quadrant', () => {
        // x = 5504 belongs to the right-hand quadrant, not the left.
        expect(quadrantIndexAt(5504, 100, rects)).toBe(1);
        expect(quadrantIndexAt(100, 3072, rects)).toBe(2);
    });

    it('returns -1 outside the level', () => {
        expect(quadrantIndexAt(-1, 100, rects)).toBe(-1);
        expect(quadrantIndexAt(100, LIBRARY.height + 1, rects)).toBe(-1);
    });
});

describe('edgeSpawnPoints', () => {
    const rect = { x: 0, y: 0, width: 5504, height: 3072 };

    it('returns the requested number of points', () => {
        expect(edgeSpawnPoints(rect, 5, 200)).toHaveLength(5);
    });

    it('keeps every point inside the quadrant by the inset', () => {
        for (const point of edgeSpawnPoints(rect, 5, 200)) {
            expect(point.x).toBeGreaterThanOrEqual(rect.x + 200);
            expect(point.x).toBeLessThanOrEqual(rect.x + rect.width - 200);
            expect(point.y).toBeGreaterThanOrEqual(rect.y + 200);
            expect(point.y).toBeLessThanOrEqual(rect.y + rect.height - 200);
        }
    });

    it('touches at least three of the four sides', () => {
        const points = edgeSpawnPoints(rect, 5, 200);
        const sides = new Set<string>();
        for (const p of points) {
            if (p.y <= rect.y + 201) sides.add('top');
            if (p.x >= rect.x + rect.width - 201) sides.add('right');
            if (p.y >= rect.y + rect.height - 201) sides.add('bottom');
            if (p.x <= rect.x + 201) sides.add('left');
        }
        expect(sides.size).toBeGreaterThanOrEqual(3);
    });

    it('spreads the points apart instead of stacking them', () => {
        const points = edgeSpawnPoints(rect, 5, 200);
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                expect(Math.hypot(dx, dy)).toBeGreaterThan(150);
            }
        }
    });

    it('is a pure function of its arguments', () => {
        expect(edgeSpawnPoints(rect, 5, 200)).toEqual(edgeSpawnPoints(rect, 5, 200));
    });
});

describe('nearRingPoints', () => {
    const player = { x: 2000, y: 1500 };

    it('returns the requested number of points', () => {
        expect(nearRingPoints(4, player, 300, 900, () => 0.5)).toHaveLength(4);
    });

    it('keeps every point inside the ring', () => {
        for (const point of nearRingPoints(4, player, 300, 900, () => 0.5)) {
            const distance = Math.hypot(point.x - player.x, point.y - player.y);
            expect(distance).toBeGreaterThanOrEqual(299);
            expect(distance).toBeLessThanOrEqual(901);
        }
    });

    it('surrounds the player rather than clustering on one side', () => {
        const points = nearRingPoints(4, player, 300, 900, () => 0.5);
        const quadrants = new Set(
            points.map((p) => `${p.x >= player.x ? 'e' : 'w'}${p.y >= player.y ? 's' : 'n'}`),
        );
        expect(quadrants.size).toBe(4);
    });
});

describe('waveComposition', () => {
    it('is four near (2 melee + 2 ranged) and five far (2 melee + 3 ranged)', () => {
        const wave = waveComposition();
        expect(wave).toHaveLength(9);

        const near = wave.filter((slot) => slot.distance === 'near');
        const far = wave.filter((slot) => slot.distance === 'far');
        expect(near).toHaveLength(4);
        expect(far).toHaveLength(5);

        const count = (list: typeof wave, role: 'melee' | 'ranged') =>
            list.filter((slot) => slot.role === role).length;
        expect(count(near, 'melee')).toBe(2);
        expect(count(near, 'ranged')).toBe(2);
        expect(count(far, 'melee')).toBe(2);
        expect(count(far, 'ranged')).toBe(3);
    });
});