/**
 * tests/lib/input/aim.test.ts
 * --------------------------------------------------------------------------
 * Eight-way aim and the vector every scheme hands downstream.
 *
 * The whole point of this module is that "which device asked" stops mattering, so
 * the tests are about directions and lengths, not about keyboard events.
 */

import { describe, expect, it } from 'vitest';

import {
    AIM_DIRECTIONS,
    aimFromIntent,
    aimPointFrom,
    directionTo,
    snapToEight,
} from '@/lib/input/aim';

const NONE = { up: false, down: false, left: false, right: false };

describe('aimFromIntent', () => {
    it('returns nothing when no direction is held', () => {
        // Keeping the previous aim beats snapping to east on release.
        expect(aimFromIntent(NONE)).toBeNull();
    });

    it('cancels opposing keys instead of picking a side', () => {
        expect(aimFromIntent({ ...NONE, left: true, right: true })).toBeNull();
        expect(aimFromIntent({ ...NONE, up: true, down: true })).toBeNull();
    });

    it('points the four cardinals', () => {
        expect(aimFromIntent({ ...NONE, right: true })).toEqual({ x: 1, y: 0 });
        expect(aimFromIntent({ ...NONE, down: true })).toEqual({ x: 0, y: 1 });
        expect(aimFromIntent({ ...NONE, left: true })).toEqual({ x: -1, y: 0 });
        expect(aimFromIntent({ ...NONE, up: true })).toEqual({ x: 0, y: -1 });
    });

    it('gives diagonals the same length as cardinals', () => {
        const diagonal = aimFromIntent({ ...NONE, up: true, right: true })!;
        // A diagonal shot must not travel further than a straight one.
        expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
        expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
        expect(diagonal.y).toBeCloseTo(-Math.SQRT1_2);
    });

    it('covers all eight directions', () => {
        const seen = new Set<string>();
        const combos = [
            { ...NONE, right: true },
            { ...NONE, right: true, down: true },
            { ...NONE, down: true },
            { ...NONE, left: true, down: true },
            { ...NONE, left: true },
            { ...NONE, left: true, up: true },
            { ...NONE, up: true },
            { ...NONE, right: true, up: true },
        ];
        for (const combo of combos) {
            const v = aimFromIntent(combo)!;
            seen.add(`${v.x.toFixed(3)},${v.y.toFixed(3)}`);
        }
        expect(seen.size).toBe(8);
        expect(AIM_DIRECTIONS).toHaveLength(8);
    });
});

describe('snapToEight', () => {
    it('snaps a nearly-east stick to exactly east', () => {
        // 17 degrees: inside the 22.5-degree half-width of the east sector.
        const v = snapToEight({ x: Math.cos(0.3), y: Math.sin(0.3) });
        expect(v).toEqual({ x: 1, y: 0 });
    });

    it('tips over to the diagonal past the halfway mark', () => {
        // 25 degrees is closer to the SE diagonal than to east.
        const v = snapToEight({ x: Math.cos(0.44), y: Math.sin(0.44) });
        expect(v).toEqual({ x: Math.SQRT1_2, y: Math.SQRT1_2 });
    });

    it('snaps a nearly-north-west stick to the NW diagonal', () => {
        const angle = -Math.PI * 0.7; // 126 degrees up-left
        const v = snapToEight({ x: Math.cos(angle), y: Math.sin(angle) });
        expect(v).toEqual({ x: -Math.SQRT1_2, y: -Math.SQRT1_2 });
    });

    it('always lands on one of the eight, and stays a unit vector', () => {
        for (let deg = 0; deg < 360; deg += 7) {
            const rad = (deg * Math.PI) / 180;
            const v = snapToEight({ x: Math.cos(rad), y: Math.sin(rad) });
            expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
            expect(AIM_DIRECTIONS.some((d) => d.x === v.x && d.y === v.y)).toBe(true);
        }
    });
});

describe('aimPointFrom / directionTo', () => {
    it('puts the aim point on the line, at the requested distance', () => {
        const p = aimPointFrom({ x: 100, y: 50 }, { x: 0, y: -1 }, 300);
        expect(p).toEqual({ x: 100, y: -250 });
    });

    it('turns a thumb position into one of eight', () => {
        // Straight up from the origin, but not exactly.
        expect(directionTo({ x: 0, y: 0 }, { x: 10, y: -100 })).toEqual({ x: 0, y: -1 });
        // Down-right.
        expect(directionTo({ x: 0, y: 0 }, { x: 80, y: 80 })).toEqual({
            x: Math.SQRT1_2,
            y: Math.SQRT1_2,
        });
    });

    it('has no direction to give when the thumb has not moved', () => {
        expect(directionTo({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
    });
});