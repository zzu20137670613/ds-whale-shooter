/**
 * tests/lib/combat/float-number.test.ts
 * --------------------------------------------------------------------------
 * Combat numbers have to be readable numbers.
 *
 * The owner's report, standing in the developer cabin: a stream of digits climbing past the
 * name plate — `40305510999999999104`, different every frame, "一直在滚动不知道啥东西".
 *
 * It was HP regen. `update()` calls `heal()` every frame with a fraction of a point
 * (`elapsedSec * healPerSec`), and `heal()` spawns a floating number for ANY non-zero delta.
 * So every frame printed `+0.036666666666666666`, sixty times a second, all of them drifting
 * up the screen together. The digits were real; there were just sixty of them a second.
 */

import { describe, expect, it } from 'vitest';

import { formatFloatAmount, shouldShowFloat } from '@/lib/combat/float-number';

describe('when a combat number is worth showing', () => {
    it('ignores the fractional trickle from per-frame regen', () => {
        // 2.2 HP/s at 60 fps is 0.0366 per call.
        expect(shouldShowFloat(0.0366666)).toBe(false);
        expect(shouldShowFloat(-0.0366666)).toBe(false);
        expect(shouldShowFloat(0.999)).toBe(false);
    });

    it('shows a whole point or more, either sign', () => {
        expect(shouldShowFloat(1)).toBe(true);
        expect(shouldShowFloat(-1)).toBe(true);
        expect(shouldShowFloat(25)).toBe(true);
        expect(shouldShowFloat(-9999)).toBe(true);
    });

    it('refuses anything that is not a finite number', () => {
        expect(shouldShowFloat(Number.NaN)).toBe(false);
        expect(shouldShowFloat(Number.POSITIVE_INFINITY)).toBe(false);
    });
});

describe('how the number is printed', () => {
    it('never prints a float tail', () => {
        // The owner's screenshot: a long `0.07333333333333333` fragment read as garbage.
        expect(formatFloatAmount(0.07333333333333)).toBe('0');
        expect(formatFloatAmount(24.999999)).toBe('25');
        expect(formatFloatAmount(-25)).toBe('25');
    });

    it('keeps a whole number intact', () => {
        expect(formatFloatAmount(9999)).toBe('9999');
        expect(formatFloatAmount(1)).toBe('1');
    });
});