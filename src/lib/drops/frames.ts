/**
 * src/lib/drops/frames.ts
 * --------------------------------------------------------------------------
 * Which frame of a drop's spritesheet to show when the idle animation is off.
 *
 * All four built-in drops share one 4x4 atlas: frames 0-3 chicken leg, 4-7 blue
 * can, 8-11 ammo, 12-15 burger. Showing frame 0 for every one of them is why
 * everything looked like a drumstick. The idle track already declares where each
 * item starts, so read it instead of assuming the atlas origin.
 */

import type { DropSpec } from './types';

/**
 * The first frame of the drop's `idle` track, or 0 when the spec declares none.
 *
 * `frames` is a `[first, last]` pair (see `AnimSpecSchema`), so the first entry
 * is the standing pose. A spec without an `idle` track has nothing better to
 * offer than frame 0.
 */
export function dropIdleFrame(spec: Pick<DropSpec, 'anims'>): number {
    return spec.anims?.idle?.frames?.[0] ?? 0;
}
