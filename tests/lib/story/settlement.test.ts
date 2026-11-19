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
    settlementPlateStart,
    settlementDuration,
} from '@/lib/story/settlement';

describe('settlement sequence', () => {
    it('runs three beats: first meeting, walk-out, ledger', () => {
        expect(SETTLEMENT_PLATES).toHaveLength(3);
        expect(SETTLEMENT_PLATES[0].id).toBe('first-meeting');
        expect(SETTLEMENT_PLATES[1].id).toBe('walk-out');
        expect(SETTLEMENT_PLATES[2].image).toBeNull();
    });

    it('gives each plate three lines, with time to read them', () => {
        // 主人 2026-11-15：`新写的这三句放第一张图，以前那三句放第二张图`。
        for (const index of [0, 1]) {
            const plate = SETTLEMENT_PLATES[index]!;
            expect(plate.captions, plate.id).toHaveLength(3);
            for (const c of plate.captions) expect(c.atMs).toBeLessThan(plate.holdMs);
            // 每句至少 1.5 秒的呼吸，最后一句也得留得住。
            for (let i = 1; i < plate.captions.length; i++) {
                expect(
                    plate.captions[i]!.atMs - plate.captions[i - 1]!.atMs,
                    `${plate.id} line ${i}`,
                ).toBeGreaterThanOrEqual(1500);
            }
            expect(plate.holdMs - plate.captions.at(-1)!.atMs).toBeGreaterThanOrEqual(1500);
        }
    });

    it('puts the new narration on the first plate', () => {
        const lines = SETTLEMENT_PLATES[0].captions.map((c) => c.text).join('');
        expect(lines).toContain('爱');
        expect(lines).toContain('白米饭');
        expect(lines).toContain('人性');
    });

    it('keeps the old dialogue on the walk-out plate', () => {
        const lines = SETTLEMENT_PLATES[1].captions.map((c) => c.text);
        expect(lines[0]).toContain('你来了');
        expect(lines[1]).toContain('会来接你');
        expect(lines[2]).toContain('谁都不用再当神');
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
        // 第一张图的第一句在 700ms 才出现，所以进图那一刻屏幕上还是空的。
        const plateStart = settlementPlateStart(0);
        const before = settlementAt(plateStart + p.captions[0].atMs - 1);
        expect(before.captions).toEqual([]);
        const afterFirst = settlementAt(plateStart + p.captions[0].atMs);
        expect(afterFirst.captions).toEqual([p.captions[0].text]);
        const afterSecond = settlementAt(plateStart + p.captions[1].atMs);
        expect(afterSecond.captions).toEqual([p.captions[0].text, p.captions[1].text]);
        const afterThird = settlementAt(plateStart + p.captions[2].atMs);
        expect(afterThird.captions).toEqual(p.captions.map((c) => c.text));
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
