/**
 * src/lib/characters/idle-pose.ts
 * --------------------------------------------------------------------------
 * What to draw while she stands still.
 *
 * The idle art is drawn front-on: every idle frame has her facing the viewer. Left and
 * right are expressed by mirroring, and mirroring a symmetric front pose changes nothing
 * visible - so standing still after walking left looked exactly like "went back to facing
 * the front".
 *
 * The walk cycle is the only art with any lean to it, so standing freezes on its first
 * frame. WHICH row that frame comes from decides the direction: the left row is hand-drawn
 * facing left and is not mirrored, so freezing on the right row's frame while unmirrored
 * draws her facing right - which is exactly the bug the owner reported twice
 * (`向左走又成了最后停的时候面朝右`).
 *
 * Two alternatives were tried and rejected on sight: looping the four idle frames (they are
 * separate generations a few pixels apart - reads as a twitch) and swaying the walk pair at
 * 3fps while standing (the legs move a little, which reads as a twitch too). A still frame
 * is the only version that holds still.
 */

import type { Facing } from './facing';

export interface IdlePose {
    /** The animation to hold, or null to freeze on a single frame. */
    anim: 'idle' | null;
    /** Frame index to freeze on when `anim` is null. */
    frame: number | null;
}

/**
 * @param facing        her last walking direction
 * @param walkStart     first frame of the right-facing walk cycle
 * @param walkLeftStart first frame of the hand-drawn left row, when the sheet has one
 */
export function idlePoseFor(
    facing: Facing,
    walkStart: number | undefined,
    walkLeftStart?: number,
): IdlePose {
    if (facing === 'front') return { anim: 'idle', frame: null };
    // Left first, even when the right row is all we have: a mirrored right frame is the
    // fallback, but the left row is the correct art on sheets that ship one.
    if (facing === 'left' && walkLeftStart !== undefined) {
        return { anim: null, frame: walkLeftStart };
    }
    if (walkStart === undefined) return { anim: 'idle', frame: null };
    return { anim: null, frame: walkStart };
}