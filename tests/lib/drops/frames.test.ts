/**
 * tests/lib/drops/frames.test.ts
 * --------------------------------------------------------------------------
 * Every dropped item rendered as the chicken leg because the animation-off
 * fallback hardcoded frame 0, and all four drops share one 4x4 atlas whose
 * frame 0 is the drumstick. The fallback now reads the spec's idle track.
 */

import { describe, expect, it } from 'vitest';

import { dropIdleFrame } from '@/lib/drops/frames';
import type { DropSpec } from '@/lib/drops/types';

const idle = (first: number, last: number) => ({
    idle: { frames: [first, last] as [number, number], frameRate: 6, repeat: -1 },
});

describe('dropIdleFrame', () => {
    it('returns the first frame of the idle track', () => {
        expect(dropIdleFrame({ anims: idle(0, 3) })).toBe(0);
        expect(dropIdleFrame({ anims: idle(4, 7) })).toBe(4);
        expect(dropIdleFrame({ anims: idle(8, 11) })).toBe(8);
        expect(dropIdleFrame({ anims: idle(12, 15) })).toBe(12);
    });

    it('falls back to zero when the spec has no idle track', () => {
        expect(dropIdleFrame({})).toBe(0);
        expect(dropIdleFrame({ anims: {} })).toBe(0);
    });

    it('does not depend on a single-frame animation being special', () => {
        // A one-frame track is still just its own first frame.
        expect(dropIdleFrame({ anims: idle(20, 20) })).toBe(20);
    });

    it('agrees with the drop specs shipped in the repo', () => {
        // These four are the atlas rows in public/data/drops/*.yaml.
        const rows = [0, 4, 8, 12];
        const specs = rows.map((first) => ({ anims: idle(first, first + 3) }) as Pick<DropSpec, 'anims'>);
        expect(specs.map(dropIdleFrame)).toEqual(rows);
    });
});