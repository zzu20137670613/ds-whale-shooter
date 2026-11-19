/**
 * tests/lib/bosses/wrath-cadence.test.ts
 * --------------------------------------------------------------------------
 * 天谴轰炸 lands every second round now, not every round.
 *
 * The owner, 2026-11-14, after playing on a phone: `把释放天谴轰炸的cd时间增加一倍`.
 * Every round used to be `primary + wrath` (`每次出两招`), and on touch controls there was no
 * sprint to reposition with, so the pair never stopped arriving.
 *
 * Two things get pinned here: the arithmetic of the throttle, and the fact that the throttle
 * is one round on / one round off rather than a timer that could drift.
 */

import { describe, expect, it } from 'vitest';

import { WRATH_EVERY_N_ROUNDS, wrathDue } from '@/lib/bosses/attacks';

describe('the wrath throttle', () => {
    it('fires on every second round', () => {
        expect(WRATH_EVERY_N_ROUNDS).toBe(2);
        expect([1, 2, 3, 4, 5, 6].map((round) => wrathDue(round))).toEqual([
            false,
            true,
            false,
            true,
            false,
            true,
        ]);
    });

    it('doubles the gap, it does not postpone the first one', () => {
        // Round 1 is a primary only, so the first wrath of the fight waits one round. That is
        // the intended read: the interval doubles, the opening move does not get an extra beat.
        expect(wrathDue(1)).toBe(false);
        expect(wrathDue(2)).toBe(true);
        const gapRounds = 2;
        expect(gapRounds).toBe(WRATH_EVERY_N_ROUNDS);
    });

    it('can be asked for any cadence without drifting', () => {
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((r) => wrathDue(r, 3))).toEqual([3, 6, 9]);
        expect([1, 2, 3, 4].filter((r) => wrathDue(r, 1))).toEqual([1, 2, 3, 4]);
    });

    it('never fires before a round has happened', () => {
        expect(wrathDue(0)).toBe(false);
        expect(wrathDue(-3)).toBe(false);
    });

    it('treats a nonsense cadence as every round', () => {
        // 0 would divide by zero; a corrupt number must not mute the attack entirely.
        expect(wrathDue(1, 0)).toBe(true);
        expect(wrathDue(2, 0)).toBe(true);
        expect(wrathDue(1, Number.NaN)).toBe(true);
    });
});
