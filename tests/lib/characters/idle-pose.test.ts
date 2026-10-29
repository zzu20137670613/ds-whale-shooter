/**
 * tests/lib/characters/idle-pose.test.ts
 * --------------------------------------------------------------------------
 * Standing still must not undo the direction she was walking.
 */

import { describe, expect, it } from 'vitest';

import { idlePoseFor } from '@/lib/characters/idle-pose';

describe('idlePoseFor', () => {
    it('uses the plain idle pose when facing front', () => {
        expect(idlePoseFor('front', 4)).toEqual({ anim: 'idle', frame: null });
    });

    it('freezes on the leaning walk stance when facing a side', () => {
        expect(idlePoseFor('left', 4)).toEqual({ anim: null, frame: 4 });
        expect(idlePoseFor('right', 4)).toEqual({ anim: null, frame: 4 });
    });

    it('falls back to idle when the character declares no walk frames', () => {
        expect(idlePoseFor('left', undefined)).toEqual({ anim: 'idle', frame: null });
    });
});