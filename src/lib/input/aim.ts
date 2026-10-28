/**
 * src/lib/input/aim.ts
 * --------------------------------------------------------------------------
 * Eight-way aiming, and the one thing every input scheme hands downstream.
 *
 * The owner's redesign: magnetic lock is OFF in both schemes. A mouse scheme aims
 * where the cursor is; a keyboard/gamepad scheme aims along one of eight
 * directions; touch aims along the direction of travel. All three end here, as a
 * single unit vector plus a point on the line out of the character — so weapons,
 * the sprite's facing and the crosshair never have to know which device asked.
 */

/** One unit vector per direction, in clock order starting at east. */
export const AIM_DIRECTIONS = [
    { x: 1, y: 0 }, // E
    { x: Math.SQRT1_2, y: Math.SQRT1_2 }, // SE
    { x: 0, y: 1 }, // S
    { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, // SW
    { x: -1, y: 0 }, // W
    { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, // NW
    { x: 0, y: -1 }, // N
    { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, // NE
] as const;

export interface AimVector {
    x: number;
    y: number;
}

/** Raw per-axis intent, in screen space: y is positive DOWN. */
export interface AimIntent {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}

/**
 * Eight-way aim from four booleans.
 *
 * Diagonals are real: holding up+right gives NE at the same length as due E, so a
 * diagonal shot is not secretly faster. Left+right together (or up+down) cancel to
 * nothing rather than picking a side, which is what a player who mashed both
 * expects.
 *
 * Returns null when nothing is held, so the caller keeps its previous aim instead
 * of snapping to east.
 */
export function aimFromIntent(intent: AimIntent): AimVector | null {
    const x = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
    const y = (intent.down ? 1 : 0) - (intent.up ? 1 : 0);
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
}

/**
 * The nearest of the eight directions to an arbitrary vector.
 *
 * Used where an input is continuous (a right stick) but the game wants eight-way
 * discipline: snapping means a stick held at 23 degrees gives exactly E, and the
 * shot is reproducible instead of drifting with the thumb.
 */
export function snapToEight(vector: AimVector): AimVector {
    const angle = Math.atan2(vector.y, vector.x);
    const index = Math.round(angle / (Math.PI / 4));
    const wrapped = ((index % 8) + 8) % 8;
    return { x: AIM_DIRECTIONS[wrapped].x, y: AIM_DIRECTIONS[wrapped].y };
}

/**
 * A point on the aim line, far enough that weapons treat it as "that way".
 *
 * `range` exists because a zero-length aim vector is not a direction; anything the
 * caller passes is multiplied out to a comfortable distance.
 */
export function aimPointFrom(
    origin: { x: number; y: number },
    direction: AimVector,
    range = 600,
): { x: number; y: number } {
    return { x: origin.x + direction.x * range, y: origin.y + direction.y * range };
}

/**
 * Which of the eight directions an arbitrary point lies in, from an origin.
 *
 * Touch uses this: the direction of travel is the aim, and the player's thumb
 * rarely lands on a clean 45 degrees.
 */
export function directionTo(
    origin: { x: number; y: number },
    point: { x: number; y: number },
): AimVector | null {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (dx === 0 && dy === 0) return null;
    return snapToEight({ x: dx, y: dy });
}