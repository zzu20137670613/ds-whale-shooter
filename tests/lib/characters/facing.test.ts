/**
 * tests/lib/characters/facing.test.ts
 * --------------------------------------------------------------------------
 * The owner's rule, one case per line of his message.
 *
 * The bug this replaces: facing followed the aim cursor and flipped every frame when the
 * pointer sat near her x, so the sprite twitched between left and right.
 */

import { describe, expect, it } from 'vitest';

import {
    FACING_DEADZONE,
    facingFromMotion,
    facingFromSpawn,
    flipXForFacing,
} from '@/lib/characters/facing';

describe('facingFromMotion', () => {
    it('walks left -> faces left', () => {
        expect(facingFromMotion(-4, 0, 'right')).toBe('left');
    });

    it('walks right -> faces right', () => {
        expect(facingFromMotion(4, 0, 'left')).toBe('right');
    });

    it('down-left and down-right read as the horizontal side', () => {
        expect(facingFromMotion(-3, 3, 'right')).toBe('left');
        expect(facingFromMotion(3, 3, 'left')).toBe('right');
    });

    it('straight down shows the front', () => {
        expect(facingFromMotion(0, 4, 'left')).toBe('front');
        expect(facingFromMotion(0, 4, 'right')).toBe('front');
    });

    it('straight up keeps whatever she was facing', () => {
        expect(facingFromMotion(0, -4, 'left')).toBe('left');
        expect(facingFromMotion(0, -4, 'right')).toBe('right');
        expect(facingFromMotion(0, -4, 'front')).toBe('front');
    });

    it('up-left and up-right read the same as down-left and down-right', () => {
        // The owner's rule: 左上右上同左下右下 - diagonals follow their horizontal side,
        // only a straight-up walk is a no-op.
        expect(facingFromMotion(-3, -3, 'right')).toBe('left');
        expect(facingFromMotion(3, -3, 'left')).toBe('right');
    });

    it('standing still does not change facing', () => {
        expect(facingFromMotion(0, 0, 'left')).toBe('left');
        expect(facingFromMotion(FACING_DEADZONE / 2, 0, 'right')).toBe('right');
    });

    it('is stable: the same velocity never oscillates', () => {
        let facing = facingFromSpawn('right');
        for (let i = 0; i < 20; i++) facing = facingFromMotion(0, 0, facing);
        expect(facing).toBe('right');
    });
});

describe('flipXForFacing', () => {
    it('mirrors only for left', () => {
        expect(flipXForFacing('left')).toBe(true);
        expect(flipXForFacing('right')).toBe(false);
        expect(flipXForFacing('front')).toBe(false);
    });
});

describe('facingFromSpawn', () => {
    it('honours the level spawn and defaults to right', () => {
        expect(facingFromSpawn('left')).toBe('left');
        expect(facingFromSpawn('right')).toBe('right');
        expect(facingFromSpawn(undefined)).toBe('right');
    });
});