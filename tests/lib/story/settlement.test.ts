/**
 * tests/lib/story/settlement.test.ts
 * --------------------------------------------------------------------------
 * `settlementAt(t)` is the whole ending as a function of time: which plate is
 * up, how far the push-in has gone, which lines have faded in, and when it is
 * over. Anything that would need a timer to test lives here instead.
 */

import { describe, expect, it } from 'vitest';

import {
    SETTLEMENT_PLATES,
    formatRunTime,
    settlementAt,
    settlementDuration,
} from '@/lib/story/settlement';

describe('settlement sequence', () => {
    it('runs three beats: first meeting, walk-out, ledger', () => {
        expect(SETTLEMENT_PLATES).toHaveLength(3);
        expect(SETTLEMENT_PLATES[0].id).toBe('first-meeting');
        expect(SETTLEMENT_PLATES[1].id).toBe('walk-out');
        expect(SETTLEMENT_PLATES[2].image).toBeNull();
    });

    it('holds the retouched plate long enough to read two lines', () => {
        const p = SETTLEMENT_PLATES[0];
        expect(p.holdMs).toBeGreaterThanOrEqual(5000);
        expect(p.captions).toHaveLength(2);
        for (const c of p.captions) expect(c.atMs).toBeLessThan(p.holdMs);
    });

    it('starts on the first plate with no caption yet', () => {
        const f = settlementAt(0);
        expect(f.plate).toBe(0);
        expect(f.captions).toEqual([]);
        expect(f.scale).toBeCloseTo(1, 5);
        expect(f.finished).toBe(false);
    });

    it('fades each line in at its own time', () => {
        const p = SETTLEMENT_PLATES[0];
        const before = settlementAt(p.captions[0].atMs - 1);
        expect(before.captions).toEqual([]);
        const afterFirst = settlementAt(p.captions[0].atMs);
        expect(afterFirst.captions).toEqual([p.captions[0].text]);
        const afterSecond = settlementAt(p.captions[1].atMs);
        expect(afterSecond.captions).toEqual([p.captions[0].text, p.captions[1].text]);
    });

    it('pushes the first plate in, slowly, and never past its zoom target', () => {
        const p = SETTLEMENT_PLATES[0];
        const mid = settlementAt(p.holdMs / 2);
        expect(mid.scale).toBeGreaterThan(1);
        expect(mid.scale).toBeLessThan(p.zoomTo);
        const end = settlementAt(p.holdMs - 1);
        expect(end.scale).toBeLessThanOrEqual(p.zoomTo + 1e-6);
    });

    it('moves to the walk-out plate when the first one is done', () => {
        const f = settlementAt(SETTLEMENT_PLATES[0].holdMs);
        expect(f.plate).toBe(1);
        expect(f.captions).toEqual([]);
        expect(f.elapsedInPlateMs).toBe(0);
    });

    it('ends after the ledger and stays ended', () => {
        const total = settlementDuration();
        expect(settlementAt(total - 1).finished).toBe(false);
        const done = settlementAt(total);
        expect(done.finished).toBe(true);
        expect(done.plate).toBe(SETTLEMENT_PLATES.length);
        expect(settlementAt(total + 60_000).finished).toBe(true);
    });

    it('formats the run time the way the ledger shows it', () => {
        expect(formatRunTime(0)).toBe('0:00');
        expect(formatRunTime(9_000)).toBe('0:09');
        expect(formatRunTime(61_000)).toBe('1:01');
        expect(formatRunTime(754_000)).toBe('12:34');
        expect(formatRunTime(-5)).toBe('0:00');
    });
});
