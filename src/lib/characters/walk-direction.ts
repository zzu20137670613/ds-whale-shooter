/**
 * src/lib/characters/walk-direction.ts
 * --------------------------------------------------------------------------
 * Which walk row plays, given which way she is facing.
 *
 * A character normally ships ONE `walk` row and the sprite is flipped when she moves left.
 * A front-facing walk has no direction to flip, so a character may instead ship a real
 * `walkLeft` row: the owner mirrors the art by hand and both directions become their own
 * frames. When that row exists the facing picks it, and the flip stays off.
 */

import type { Facing } from '@/lib/characters/facing';

/** The walk track for this facing: `walkLeft` when the spec has one, `walk` otherwise. */
export function walkTrackFor(facing: Facing, hasWalkLeft: boolean): 'walk' | 'walkLeft' {
    return hasWalkLeft && facing === 'left' ? 'walkLeft' : 'walk';
}
