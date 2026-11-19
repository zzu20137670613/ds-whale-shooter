/**
 * src/lib/characters/walk-bob.ts
 * --------------------------------------------------------------------------
 * A small vertical bounce while she walks.
 *
 * The owner watched the same four walk frames side by side and reported the ones that read
 * as "her legs are not moving". He is right, and the numbers say why: the difference between
 * the first and last walk frame in the leg band is 31 for GPT but 8.5 for DeepSeek - her
 * walk frames are nearly the same pose. No frame rate or frame order fixes that; the art has
 * almost no stride to show.
 *
 * A 2px bounce at the stride cadence is the cheapest honest fix: it does not invent legs, it
 * just lets the body move the way a walking body does, and it makes a stiff cycle read as
 * steps instead of a slide.
 */

import { WALK_BOB_HZ, WALK_BOB_PX } from '@/lib/constants';

/**
 * Vertical offset in px for a given phase.
 *
 * @param phaseSeconds how long she has been walking, in seconds
 * @param moving       false the moment she stops, so the offset snaps back to 0
 */
export function walkBob(phaseSeconds: number, moving: boolean): number {
    if (!moving) return 0;
    return Math.sin(phaseSeconds * WALK_BOB_HZ * Math.PI * 2) * WALK_BOB_PX;
}

/** Phase after `deltaMs`, frozen (not reset) when she stops so restarting has no jump. */
export function advanceBobPhase(phaseSeconds: number, deltaMs: number, moving: boolean): number {
    if (!moving) return phaseSeconds;
    return phaseSeconds + Math.max(0, deltaMs) / 1000;
}