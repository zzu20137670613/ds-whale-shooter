/**
 * src/lib/characters/mirror.ts
 * --------------------------------------------------------------------------
 * Whether a character track may be flipped on a left/right move.
 *
 * Most of her tracks are drawn in profile, so flipping is how she faces the other way. The
 * front-facing ones are not: flipping those swaps her hair and tail to the wrong side and the
 * player reads it as a turn. `mirror: false` in the character YAML opts a track out.
 */

import type { AnimSpec } from '@/lib/characters/types';

/** True when the sprite may be flipped while this track plays. Default: yes. */
export function mirrorForAnim(anim: AnimSpec | undefined): boolean {
    return anim?.mirror !== false;
}
