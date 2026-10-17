import { describe, expect, it } from 'vitest';

import {
    RUNNER_FRAMES,
    RUNNER_H,
    RUNNER_PALETTE,
    RUNNER_STEPS_PER_BREATH,
    RUNNER_W,
    runnerFrameAt,
    runnerPixels,
    runnerStrideS,
    type PaletteKey,
} from '@/lib/boot-loading/runner';
import { BOOT_LOADING } from '@/lib/constants';

const CHARS = new Set<string>(['.', ...Object.keys(RUNNER_PALETTE)]);

/** `row` slid one column right / left, with the vacated column left transparent. */
const slideRight = (row: string): string => `.${row.slice(0, -1)}`;
const slideLeft = (row: string): string => `${row.slice(1)}.`;

const PAD = 2; // transparent columns kept free either side, so the one-pixel sway never clips

describe('runner sprite data', () => {
    it('is four frames — two contacts and two passes', () => {
        expect(RUNNER_FRAMES).toHaveLength(4);
        expect(RUNNER_FRAMES.map((f) => f.bob)).toEqual([0, 1, 0, 1]);
    });

    it('is a 40×48 grid — every row exactly RUNNER_W characters', () => {
        expect(RUNNER_W).toBe(40);
        expect(RUNNER_H).toBe(48);
        for (const frame of RUNNER_FRAMES) {
            expect(frame.rows).toHaveLength(RUNNER_H);
            for (const row of frame.rows) expect(row).toHaveLength(RUNNER_W);
        }
    });

    it('uses only palette characters, never a colour outside the palette', () => {
        for (const frame of RUNNER_FRAMES) {
            for (const row of frame.rows) {
                for (const ch of row) expect(CHARS.has(ch)).toBe(true);
            }
        }
    });

    it('paints every palette colour, so no entry is dead weight', () => {
        const all = Object.keys(RUNNER_PALETTE) as PaletteKey[];
        expect(all).toHaveLength(20); // twenty colours: the quantisation budget
        const keys = new Set(runnerPixels(RUNNER_FRAMES[0]).map((p) => p.key));
        for (const key of all) expect(keys.has(key)).toBe(true);
    });

    it('is the whale-girl quantised — her blue leads, with whites and warm skin under it', () => {
        const hexes = Object.values(RUNNER_PALETTE);
        for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        // most of the palette is blue: her hair, her dress and her tail are nearly all of her
        expect(hexes.filter((h) => channel(h, 'b') > channel(h, 'r') + 30).length).toBeGreaterThan(7);
        // a near-white for the headdress, the apron and the pale hair tips
        expect(hexes.some((h) => Math.min(...channelList(h)) > 0xd0)).toBe(true);
        // warm skin, and a near-black holding the silhouette together
        expect(hexes.some((h) => channel(h, 'r') > channel(h, 'b') + 25)).toBe(true);
        expect(hexes.some((h) => Math.max(...channelList(h)) < 0x30)).toBe(true);
    });

    it('keeps the top row clear and stands her on the bottom row', () => {
        for (const frame of RUNNER_FRAMES) {
            // the top row is always empty, so the one-pixel bob never runs off the sprite
            expect(frame.rows[0]).toBe('.'.repeat(RUNNER_W));
            // her feet sit on the very last row. The rows are pre-bob: `bob` is applied when the
            // frame is drawn (and when it is flattened), so every frame carries the same feet and
            // the pass frames lift the whole figure a pixel clear of the bar.
            expect(frame.rows[RUNNER_H - 1]).not.toBe('.'.repeat(RUNNER_W));
        }
    });

    it('keeps transparent margins either side, so the one-pixel sway never clips her', () => {
        for (const frame of RUNNER_FRAMES) {
            for (const row of frame.rows) {
                expect(row.slice(0, PAD)).toBe('.'.repeat(PAD));
                expect(row.slice(-PAD)).toBe('.'.repeat(PAD));
            }
        }
    });

    it('draws the same figure in every frame — the walk is a bounce, not a new pose', () => {
        const counts = RUNNER_FRAMES.map((f) => runnerPixels(f).length);
        for (const n of counts) expect(n).toBe(counts[0]);
    });

    it('moves her exactly one pixel either way on the sway frames, and nowhere else', () => {
        const [contactL, , contactR, stagger] = RUNNER_FRAMES;
        // the right contact is the base slid one column right, the stagger one column left
        expect(contactR.rows).toEqual(contactL.rows.map(slideRight));
        expect(stagger.rows).toEqual(contactL.rows.map(slideLeft));
        // the pass frames reuse the base rows outright: their motion is the bob alone
        expect(RUNNER_FRAMES[1].rows).toEqual(contactL.rows);
    });

    it('bobs the two pass frames up by exactly one pixel so the step reads as a stride', () => {
        const ys = (f: (typeof RUNNER_FRAMES)[number]): number[] => runnerPixels(f).map((p) => p.y);
        expect(Math.min(...ys(RUNNER_FRAMES[1])) - Math.min(...ys(RUNNER_FRAMES[0]))).toBe(-1);
        expect(Math.min(...ys(RUNNER_FRAMES[3])) - Math.min(...ys(RUNNER_FRAMES[2]))).toBe(-1);
    });

    it('gives the four rendered frames four distinct looks', () => {
        const looks = new Set(
            RUNNER_FRAMES.map((f) =>
                runnerPixels(f)
                    .map((p) => `${p.x},${p.y},${p.color}`)
                    .join('|'),
            ),
        );
        expect(looks.size).toBe(4);
    });

    it('flattens to opaque pixels inside the grid, coloured from the palette', () => {
        for (const frame of RUNNER_FRAMES) {
            const px = runnerPixels(frame);
            expect(px.length).toBeGreaterThan(600);
            for (const p of px) {
                expect(p.color).toBe(RUNNER_PALETTE[p.key]);
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.x).toBeLessThan(RUNNER_W);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeLessThan(RUNNER_H);
            }
        }
    });
});

describe('runnerFrameAt', () => {
    const w = BOOT_LOADING.BREATH_W;
    const period = (2 * Math.PI) / w; // one breath, the same period breath() uses

    it('only ever returns one of the four frames', () => {
        for (let i = 0; i < 400; i++) expect([0, 1, 2, 3]).toContain(runnerFrameAt(i * 0.05, w));
    });

    it('runs on the breath period, stepping four evenly spaced times per breath', () => {
        expect(runnerStrideS(w) * RUNNER_STEPS_PER_BREATH).toBeCloseTo(period, 9);
        const flips: number[] = [];
        const steps = 2000;
        for (let i = 1; i <= steps; i++) {
            const t = (i / steps) * period;
            if (runnerFrameAt(t, w) !== runnerFrameAt(t - period / steps, w)) {
                flips.push(t / period);
            }
        }
        expect(flips).toHaveLength(RUNNER_STEPS_PER_BREATH);
        flips.forEach((at, i) => expect(at).toBeCloseTo((i + 1) / RUNNER_STEPS_PER_BREATH, 2));
    });

    it('visits every frame once per breath', () => {
        const seen = new Set<number>();
        const steps = 400;
        for (let i = 0; i < steps; i++) seen.add(runnerFrameAt((i / steps) * period, w));
        expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    });

    it('steps at a walkable cadence — a step every breath quarter to half a second', () => {
        const step = runnerStrideS(w);
        expect(step).toBeGreaterThan(0.25);
        expect(step).toBeLessThan(1.2);
    });
});

function channel(h: string, ch: 'r' | 'g' | 'b'): number {
    const n = parseInt(h.slice(1), 16);
    if (ch === 'r') return (n >> 16) & 0xff;
    if (ch === 'g') return (n >> 8) & 0xff;
    return n & 0xff;
}

function channelList(h: string): number[] {
    return [channel(h, 'r'), channel(h, 'g'), channel(h, 'b')];
}