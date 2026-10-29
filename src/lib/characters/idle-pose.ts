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
 * The walk cycle is the only art with any lean to it. Standing therefore freezes on the
 * first walk frame when she is facing a side, and uses the plain idle pose when she is
 * facing front. She keeps her direction when she stops, instead of snapping to the
 * centred stance.
 */

import type { Facing } from './facing';

export interface IdlePose {
    /** The animation to hold, or null to freeze on a single frame. */
    anim: 'idle' | null;
    /** Frame index to freeze on when `anim` is null. */
    frame: number | null;
}

/**
 * @param facing    her last walking direction
 * @param walkStart first frame of the walk cycle (the leaning stance)
 */
export function idlePoseFor(facing: Facing, walkStart: number | undefined): IdlePose {
    if (facing === 'front' || walkStart === undefined) return { anim: 'idle', frame: null };
    return { anim: null, frame: walkStart };
}