/**
 * tests/lib/characters/idle-pose.test.ts
 * --------------------------------------------------------------------------
 * Standing still must not undo the direction she was walking - and must not look dead
 * either.
 *
 * Two failed attempts are pinned here. Looping the four idle frames read as a twitch (they
 * are separate generations a few pixels apart). Freezing one walk frame kept the direction
 * but looked like a hiccup mid-stride. The answer is the walk pair at 3fps: direction kept,
 * motion small enough not to read as walking.
 */

import { describe, expect, it } from 'vitest';

import { idlePoseFor } from '@/lib/characters/idle-pose';

describe('idlePoseFor', () => {
    it('uses the plain idle pose when facing front', () => {
        expect(idlePoseFor('front', 4)).toEqual({ anim: 'idle', frame: null });
    });

    it('sways on the side idle instead of freezing mid-stride', () => {
        expect(idlePoseFor('left', 4)).toEqual({ anim: 'idleSide', frame: null });
        expect(idlePoseFor('right', 4)).toEqual({ anim: 'idleSide', frame: null });
    });

    it('never plays a missing animation when the sheet declares no walk frames', () => {
        // A sheet with no walk pair has nothing to sway with - freeze instead of asking for
        // an animation key that does not exist.
        expect(idlePoseFor('left', undefined)).toEqual({ anim: null, frame: null });
    });

    it('keeps the direction both ways', () => {
        expect(idlePoseFor('left', 4).anim).toBe(idlePoseFor('right', 4).anim);
    });
});
