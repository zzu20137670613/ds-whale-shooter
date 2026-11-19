/**
 * tests/lib/story/settlement-video.test.ts
 * --------------------------------------------------------------------------
 * Where 牵手 sits in the ending.
 *
 * The owner: `在…你和Claude牵手走出教堂的那张图之后，弹创造不易那个弹框之前（加在中间）`.
 * `settlementPlateEnd` is the boundary the overlay freezes on, so it has to agree with the
 * plates it is derived from.
 */

import { describe, expect, it } from 'vitest';

import {
    SETTLEMENT_PLATES,
    settlementDuration,
    settlementPlateEnd,
    settlementPlateStart,
    settlementTapElapsed,
} from '@/lib/story/settlement';

describe('plate boundaries', () => {
    it('starts the first plate at zero', () => {
        expect(settlementPlateStart(0)).toBe(0);
    });

    it('ends a plate where the next one starts', () => {
        for (let i = 0; i < SETTLEMENT_PLATES.length - 1; i += 1) {
            expect(settlementPlateEnd(i)).toBe(settlementPlateStart(i + 1));
        }
    });

    it('ends the last plate at the total duration', () => {
        expect(settlementPlateEnd(SETTLEMENT_PLATES.length - 1)).toBe(settlementDuration());
    });
});

describe('the walk-out plate, where the clip goes', () => {
    it('is the second plate', () => {
        expect(SETTLEMENT_PLATES[1].id).toBe('walk-out');
    });

    it('ends before the ledger, which is what the clip is inserted in front of', () => {
        const walkOutEnd = settlementPlateEnd(1);
        const ledgerStart = settlementPlateStart(2);
        expect(walkOutEnd).toBe(ledgerStart);
        expect(SETTLEMENT_PLATES[2].image).toBeNull();
    });

    it("leaves the ledger's hold time untouched", () => {
        // Freezing the clock must not eat the ledger: the plate still gets its full 4s.
        expect(SETTLEMENT_PLATES[2].holdMs).toBe(4000);
    });
});

describe('what a tap on the ending is allowed to skip', () => {
    it('cannot skip the clip before it has played - it starts it instead', () => {
        // The tap lands ON the hand-off, which is what starts 牵手. It used to land past it.
        expect(settlementTapElapsed(false, false)).toBe(settlementPlateEnd(1));
        expect(settlementTapElapsed(false, false)).toBeLessThan(settlementDuration());
    });

    it('does nothing while the clip is running - the player skips the video, not the ending', () => {
        expect(settlementTapElapsed(true, true)).toBeNull();
    });

    it('ends the ending once the clip is over', () => {
        expect(settlementTapElapsed(true, false)).toBe(settlementDuration());
    });
});
