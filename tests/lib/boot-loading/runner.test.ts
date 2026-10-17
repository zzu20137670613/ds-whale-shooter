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

const CHARS = new Set<string>(['.', ...(Object.keys(RUNNER_PALETTE) as PaletteKey[])]);

/** Length of the run of `ch` that starts at the first `ch` in `row`. */
function runLength(row: string, ch: string): number {
    let n = 0;
    for (const c of row) {
        if (c !== ch) break;
        n++;
    }
    return n;
}

/** Row index of the first row matching `re`. */
function firstRow(re: RegExp): number {
    return RUNNER_FRAMES[0].rows.findIndex((r) => re.test(r));
}

describe('runner sprite data', () => {
    it('is four frames — two contacts and two passes', () => {
        expect(RUNNER_FRAMES).toHaveLength(4);
        expect(new Set(RUNNER_FRAMES.map((f) => f.rows.join('|'))).size).toBe(4);
    });

    it('is a 20×24 grid — every row exactly RUNNER_W characters', () => {
        expect(RUNNER_W).toBe(20);
        expect(RUNNER_H).toBe(24);
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

    it('paints every palette colour in every frame, so no entry is dead weight', () => {
        const all = Object.keys(RUNNER_PALETTE) as PaletteKey[];
        for (const frame of RUNNER_FRAMES) {
            const keys = new Set(runnerPixels(frame).map((p) => p.key));
            for (const key of all) expect(keys.has(key)).toBe(true);
        }
    });

    it('paints her in the key art blues — hair blue, dress a darker navy, outline near-black', () => {
        for (const hex of Object.values(RUNNER_PALETTE)) {
            expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        }
        // hair is blue, and the lit streak is lighter than it
        expect(channel(RUNNER_PALETTE.H, 'b')).toBeGreaterThan(channel(RUNNER_PALETTE.H, 'r'));
        expect(channel(RUNNER_PALETTE.l, 'b')).toBeGreaterThan(channel(RUNNER_PALETTE.H, 'b'));
        // the dress is navy and clearly darker than the hair it falls over
        expect(channel(RUNNER_PALETTE.D, 'b')).toBeLessThan(channel(RUNNER_PALETTE.H, 'b'));
        // the whites of the headdress, the tips and the apron are all near-white
        for (const k of ['A', 'W', 'P'] as const) {
            expect(Math.min(...channelList(RUNNER_PALETTE[k]))).toBeGreaterThan(0xd0);
        }
        // skin stays warm, and the outline is the darkest thing on the sprite
        expect(channel(RUNNER_PALETTE.S, 'r')).toBeGreaterThan(channel(RUNNER_PALETTE.S, 'b'));
        expect(Math.max(...channelList(RUNNER_PALETTE.o))).toBeLessThan(0x40);
    });

    it('gives the skin a jaw shade, the hair a lit streak, and keeps the whale mark distinct', () => {
        for (const ch of ['r', 'g', 'b'] as const) {
            expect(channel(RUNNER_PALETTE.s, ch)).toBeLessThan(channel(RUNNER_PALETTE.S, ch));
        }
        expect(RUNNER_PALETTE.l).not.toBe(RUNNER_PALETTE.H);
        // the apron mark has to read against both the white apron and the blue hair
        expect(RUNNER_PALETTE.m).not.toBe(RUNNER_PALETTE.P);
        expect(RUNNER_PALETTE.m).not.toBe(RUNNER_PALETTE.H);
        expect(RUNNER_PALETTE.K).not.toBe(RUNNER_PALETTE.o);
    });

    it('gives her long blue hair that falls past the shoulders and pales to white at the tips', () => {
        const rows = RUNNER_FRAMES[0].rows;
        // the widest hair row spans at least 10 px — a big head on a short body
        const hair = rows.join('\n').match(/[Hl]+/g) ?? [];
        expect(hair.length).toBeGreaterThanOrEqual(3);
        expect(Math.max(...hair.map((r) => r.length))).toBeGreaterThanOrEqual(10);
        // the pale tips appear at the temples, below the eyes but still on the face
        expect(firstRow(/oWHH/)).toBeGreaterThan(firstRow(/oHSE/));
        // and the hair is still there below the waist, either side of the skirt
        expect(rows[11]).toContain('WWHHsSSsHHWW');
        expect(rows[17]).toContain('WWDDDDDDDDDDWW');
    });

    it('wears a white frilled headdress above the hair, with one stray hair on top', () => {
        const rows = RUNNER_FRAMES[0].rows;
        // the ahoge: a single loose tip, and the widest gap in the sprite
        expect(rows[1]).toMatch(/(^|\.)o\.o/);
        expect(runLength(rows[1].slice(rows[1].indexOf('o')), 'o')).toBe(1);
        // the frill is one scalloped white row, and it sits above every hair pixel
        expect(rows[2]).toContain('oAAAAAAAAo');
        expect(firstRow(/AAAA/)).toBeLessThan(firstRow(/HHHH/));
    });

    it('draws two big eyes with a catchlight in each, and no glasses around them', () => {
        const rows = RUNNER_FRAMES[0].rows;
        const eye = firstRow(/EESSSEES/);
        expect(eye).toBeGreaterThan(-1);
        // exactly two irises, two pixels wide each, split by the bridge
        expect([...rows[eye].matchAll(/E+/g)].map((m) => m[0])).toEqual(['EE', 'EE']);
        // one catchlight inside each iris on the row below
        expect(rows[eye + 1]).toMatch(/EeSSSEeS/);
        // no rim: nothing darker than the skin wraps the eyes on either side of them
        expect(rows[eye][rows[eye].indexOf('EE') - 1]).toBe('S');
        expect(rows[eye][rows[eye].lastIndexOf('EE') + 2]).toBe('S');
    });

    it('ties a white apron on, with the little whale mark on the bib', () => {
        const rows = RUNNER_FRAMES[0].rows;
        const apron = firstRow(/DPPPPD/);
        const face = firstRow(/SSSSSSSHH/);
        expect(apron).toBeGreaterThan(face); // the apron is below the face
        expect(rows[apron]).toContain('DPPPPD');
        // the mark: two rows of it, on the apron, with the apron either side
        expect(rows[apron + 1]).toContain('PmmP');
        expect(rows[apron + 2]).toContain('PmmP');
        // and the apron is white all the way down to its hem
        expect(rows[apron + 3]).toContain('PPPP');
    });

    it('puts the navy dress below the apron, and her shoes on the bottom row', () => {
        const rows = RUNNER_FRAMES[0].rows;
        const dress = firstRow(/DDDDDDDDDD/);
        expect(dress).toBeGreaterThan(firstRow(/DPPPPD/));
        // the skirt flares wider than any row above it
        const widths = rows.map((r) => r.length - r.replace(/[^D]/g, '').length);
        expect(Math.max(...widths)).toBeGreaterThanOrEqual(10);
        // shoes near the bottom, and the very last row is the outline she stands on
        expect(rows[RUNNER_H - 2]).toContain('KK');
        expect(rows[RUNNER_H - 1]).toMatch(/^\.+o+\.+o+\.+$/);
    });

    it('carries the walk in the legs: nothing above them moves, every frame differs below', () => {
        const [a, b, c, d] = RUNNER_FRAMES;
        const legs = 22; // the first row that is only legs
        for (const other of [b, c, d]) {
            const same = a.rows.slice(0, legs).filter((row, i) => row !== other.rows[i]);
            expect(same).toHaveLength(0);
        }
        // the legs themselves do differ, frame to frame
        const feet = new Set(RUNNER_FRAMES.map((f) => f.rows[legs]));
        expect(feet.size).toBe(4);
    });

    it('bobs the two pass frames up by exactly one pixel so the step reads as a stride', () => {
        expect(RUNNER_FRAMES.map((f) => f.bob)).toEqual([0, 1, 0, 1]);
        const ys = (f: (typeof RUNNER_FRAMES)[number]): number[] => runnerPixels(f).map((p) => p.y);
        expect(Math.min(...ys(RUNNER_FRAMES[1])) - Math.min(...ys(RUNNER_FRAMES[0]))).toBe(-1);
    });

    it('flattens to opaque pixels inside the grid, coloured from the palette', () => {
        for (const frame of RUNNER_FRAMES) {
            const px = runnerPixels(frame);
            expect(px.length).toBeGreaterThan(150);
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