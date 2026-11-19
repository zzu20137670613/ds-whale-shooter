/**
 * tests/lib/characters/mirror.test.ts
 * --------------------------------------------------------------------------
 * A front-facing walk must not be mirrored.
 *
 * The owner, walking with the 3155 sheet: `不抽，但是左右反了`. The art is her front view -
 * the same pose as her idle - so flipping it on a left/right move only swaps her hair and
 * tail to the wrong side and reads as "she turned around" instead of "she walked left".
 *
 * A per-animation `mirror` flag on `AnimsSpec.walk` turns the flip off for tracks that face
 * the camera. Default stays `true`, so side-facing rows (run, dodge) keep flipping.
 */

import { describe, expect, it } from 'vitest';

import { flipXForFacing } from '@/lib/characters/facing';
import { mirrorForAnim } from '@/lib/characters/mirror';
import { parseCharacterYaml } from '@/lib/characters/parser';

const BASE = `
id: dummy
name: Dummy
hp: 100
sp: 50
moveSpeed: 5
body: { halfW: 16, halfH: 16 }
dodge: { spCost: 10, speed: 12, durationMs: 200, cooldownMs: 500 }
hotbar: []
`;

describe('the mirror flag', () => {
    it('defaults to mirroring, so side-facing rows keep working', () => {
        const spec = parseCharacterYaml(
            `${BASE}
anims:
    run:
        frames: [8, 11]
        frameRate: 12
        repeat: -1
`,
            'dummy',
        );
        expect(mirrorForAnim(spec.anims?.run)).toBe(true);
    });

    it('turns the flip off when a track says mirror: false', () => {
        const spec = parseCharacterYaml(
            `${BASE}
anims:
    walk:
        frames: [4, 7]
        frameRate: 8
        repeat: -1
        mirror: false
`,
            'dummy',
        );
        expect(mirrorForAnim(spec.anims?.walk)).toBe(false);
    });

    it('mirrors when there is no anim spec at all', () => {
        expect(mirrorForAnim(undefined)).toBe(true);
    });

    it('still flips the sprite for a left facing when the track allows it', () => {
        expect(flipXForFacing('left')).toBe(true);
        expect(flipXForFacing('right')).toBe(false);
    });
});