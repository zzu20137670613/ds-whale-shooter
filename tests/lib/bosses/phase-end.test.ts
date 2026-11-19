/**
 * tests/lib/bosses/phase-end.test.ts
 * --------------------------------------------------------------------------
 * When a phase's bar is done.
 *
 * The owner: `最后一个阶段的Claude并没有触发半血直接结算，而是血条打开了才结算的`.
 *
 * Phases 1-4 are emptied. The last form ends at half a bar: by then she is a person again,
 * and the fight is over the moment she is beaten rather than drained to nothing.
 */

import { describe, expect, it } from 'vitest';

import { BOSS_PHASES, FINAL_PHASE_END_FRACTION, phaseEndHp } from '@/lib/bosses/phases';

const COUNT = BOSS_PHASES.length;

describe('phases one to four', () => {
    it('end only when the bar is empty', () => {
        for (const index of [0, 1, 2]) {
            expect(phaseEndHp(index, 2000, COUNT)).toBe(0);
        }
    });
});

describe('the last form', () => {
    it('ends at half a bar', () => {
        expect(FINAL_PHASE_END_FRACTION).toBe(0.5);
        expect(phaseEndHp(4, 1600, COUNT)).toBe(800);
    });

    it('so half of it left is already a win', () => {
        const floor = phaseEndHp(4, 1600, COUNT);
        expect(800 <= floor).toBe(true);
        expect(801 <= floor).toBe(false);
    });

    it('never lets the settle wait for zero', () => {
        expect(phaseEndHp(4, 3200, COUNT)).toBeGreaterThan(0);
    });
});

describe('the ladder as a whole', () => {
    it('only the final rung has a non-zero floor', () => {
        const floors = BOSS_PHASES.map((_, index) => phaseEndHp(index, 1000, COUNT));
        expect(floors.slice(0, -1).every((v) => v === 0)).toBe(true);
        expect(floors[COUNT - 1]).toBe(500);
    });
});