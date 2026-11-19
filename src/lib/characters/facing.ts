/**
 * src/lib/characters/facing.ts
 * --------------------------------------------------------------------------
 * Which way the sprite is drawn.
 *
 * Facing used to come from the aim cursor (`sprite.setFlipX(cursorX < herX)`), updated
 * every frame. With the pointer resting near her own x - or drifting by a pixel - that
 * comparison alternated left/right on consecutive frames, and the sprite visibly
 * twitched. Aim is also not what the owner wants deciding this: he wants the walking
 * direction to decide, so a girl shooting backwards still looks like she is walking
 * forwards.
 *
 * The rule, in his words:
 *
 *   - left / down-left  -> left
 *   - right / down-right -> right
 *   - straight down     -> front
 *   - straight up, up-left, up-right -> whatever she was facing before going up
 *
 * The art has one drawn orientation per frame (mirrored for the other side), so "front"
 * is simply the un-mirrored sprite.
 */

export type Facing = 'left' | 'right' | 'front';

/** Below this speed (px/step) she is standing still, not walking. */
export const FACING_DEADZONE = 0.5;

/**
 * Next facing, given her velocity and what she was facing last.
 *
 * Horizontal motion wins outright - a diagonal walk reads as left or right. Straight
 * down resets to front. Straight up is deliberately a no-op: walking up and down the
 * same lane must not spin her around.
 */
export function facingFromMotion(
    vx: number,
    vy: number,
    previous: Facing,
    deadzone: number = FACING_DEADZONE,
): Facing {
    if (Math.abs(vx) > deadzone) return vx < 0 ? 'left' : 'right';
    if (vy > deadzone) return 'front';
    return previous;
}

/** Whether the sprite should be mirrored for this facing. */
export function flipXForFacing(facing: Facing): boolean {
    return facing === 'left';
}

/** Map a level's spawn `facing` onto the runtime facing. */
export function facingFromSpawn(facing: 'left' | 'right' | undefined): Facing {
    return facing === 'left' ? 'left' : 'right';
}