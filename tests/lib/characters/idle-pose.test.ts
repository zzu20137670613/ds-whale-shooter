/**
 * tests/lib/characters/idle-pose.test.ts
 * --------------------------------------------------------------------------
 * Standing still must not undo the direction she was walking - and must hold still.
 *
 * Three attempts are pinned here. Looping the four idle frames read as a twitch (they are
 * separate generations a few pixels apart). Swaying the walk pair at 3fps while standing
 * read as a twitch too - the legs move a little. A still frame is the only version that
 * holds still, so the direction is kept by freezing on the walk stance.
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

describe('facing left', () => {
    it('freezes on the LEFT row when the sheet ships one', () => {
        // The regression: passing the right row's frame while the sprite is unmirrored
        // draws her facing right (`向左走又成了最后停的时候面朝右`).
        expect(idlePoseFor('left', 4, 16)).toEqual({ anim: null, frame: 16 });
    });

    it('falls back to the right row when there is no left row', () => {
        // Gemini/GPT/Qwen/Claude have no walkLeft row; they mirror instead.
        expect(idlePoseFor('left', 4, undefined)).toEqual({ anim: null, frame: 4 });
    });

    it('does not use the left row when facing right', () => {
        expect(idlePoseFor('right', 4, 16)).toEqual({ anim: null, frame: 4 });
    });

    it('still holds the idle pose when facing front, whatever rows exist', () => {
        expect(idlePoseFor('front', 4, 16)).toEqual({ anim: 'idle', frame: null });
    });
});
