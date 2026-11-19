/**
 * tests/lib/characters/walk-bob.test.ts
 * --------------------------------------------------------------------------
 * The 2px bounce that makes a stiff walk cycle read as steps.
 *
 * The owner compared the same four walk frames across the roster: GPT's legs move, DeepSeek's
 * and Claude's look like a slide. Measured in the leg band, frame 4 vs frame 7 differs by 31
 * for GPT and 8.5 for DeepSeek - the art has almost no stride to show. This test pins the
 * only thing code can honestly add: the body moving up and down.
 */

import { describe, expect, it } from 'vitest';

import { WALK_BOB_HZ, WALK_BOB_PX } from '@/lib/constants';
import { advanceBobPhase, walkBob } from '@/lib/characters/walk-bob';

describe('walkBob', () => {
    it('is flat while standing still', () => {
        expect(walkBob(0, false)).toBe(0);
        expect(walkBob(12.34, false)).toBe(0);
    });

    it('starts at zero and stays inside the amplitude', () => {
        expect(walkBob(0, true)).toBeCloseTo(0, 6);
        for (let t = 0; t < 2; t += 0.05) {
            expect(Math.abs(walkBob(t, true))).toBeLessThanOrEqual(WALK_BOB_PX + 1e-9);
        }
    });

    it('reaches its peak a quarter cycle in', () => {
        expect(walkBob(1 / (WALK_BOB_HZ * 4), true)).toBeCloseTo(WALK_BOB_PX, 6);
    });

    it('comes back to zero a half cycle in', () => {
        expect(walkBob(1 / (WALK_BOB_HZ * 2), true)).toBeCloseTo(0, 6);
    });
});

describe('advanceBobPhase', () => {
    it('follows real time while walking', () => {
        expect(advanceBobPhase(0, 500, true)).toBeCloseTo(0.5, 6);
    });

    it('freezes while standing, so restarting never jumps', () => {
        expect(advanceBobPhase(3, 500, false)).toBe(3);
    });

    it('ignores a negative delta instead of running the phase backwards', () => {
        expect(advanceBobPhase(1, -250, true)).toBe(1);
    });
});