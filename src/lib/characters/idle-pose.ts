/**
 * src/lib/characters/idle-pose.ts
 * --------------------------------------------------------------------------
 * What to draw while she stands still.
 *
 * The whole sheet is drawn front-on: every frame, idle and walk, has her facing the
 * viewer. Left and right are expressed by mirroring, and mirroring a symmetric front pose
 * changes nothing visible - so standing still after walking left looked exactly like
 * "went back to facing the front".
 *
 * The walk cycle is the only art with any lean to it. Facing a side therefore uses
 * `idleSide` - the walk pair at 3fps - so she keeps her direction AND keeps breathing
 * instead of freezing mid-stride. Facing front uses the plain idle pose.
 *
 * The slow pair matters: a single frozen walk frame reads as a hiccup, and the four
 * front-on idle frames read as a twitch (they are separate generations, a few pixels
 * apart). Two frames at 3fps is the smallest motion that still looks alive.
 */

import type { Facing } from './facing';

export interface IdlePose {
    /** The animation to hold, or null to freeze on a single frame. */
    anim: 'idle' | 'idleSide' | null;
    /** Frame index to freeze on when `anim` is null. */
    frame: number | null;
}

/**
 * @param facing    her last walking direction
 * @param walkStart first frame of the walk cycle (the leaning stance)
 */
export function idlePoseFor(facing: Facing, walkStart: number | undefined): IdlePose {
    if (facing === 'front') return { anim: 'idle', frame: null };
    // A sheet with no walk frames cannot sway; freeze rather than play a missing key.
    if (walkStart === undefined) return { anim: null, frame: null };
    return { anim: 'idleSide', frame: null };
}