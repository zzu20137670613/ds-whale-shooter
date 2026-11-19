// @vitest-environment node
/**
 * tests/lib/characters/anim-frames.test.ts
 * --------------------------------------------------------------------------
 * Which sprite cells one track plays, and in which order.
 *
 * `frames` is a closed range, which is all a normal cycle needs. A walk cycle
 * that reads backwards needs its middle two cells swapped, and that cannot be
 * said with a range - hence `order`.
 */

import { describe, expect, it } from 'vitest';

import { animFrameNumbers } from '@/lib/characters/anim-frames';

describe('animFrameNumbers', () => {
    it('expands a range into every cell between its ends', () => {
        expect(animFrameNumbers([4, 7])).toEqual([4, 5, 6, 7]);
    });

    it('keeps a single cell a single cell', () => {
        expect(animFrameNumbers([3, 3])).toEqual([3]);
    });

    it('plays an explicit order verbatim', () => {
        expect(animFrameNumbers([4, 7], [4, 6, 5, 7])).toEqual([4, 6, 5, 7]);
    });

    it('copes with an empty order by falling back to the range', () => {
        expect(animFrameNumbers([12, 15], [])).toEqual([12, 13, 14, 15]);
    });

    it('does not mutate the caller arrays', () => {
        const frames: [number, number] = [4, 7];
        const order = [4, 6, 5, 7];
        animFrameNumbers(frames, order);
        expect(frames).toEqual([4, 7]);
        expect(order).toEqual([4, 6, 5, 7]);
    });
});