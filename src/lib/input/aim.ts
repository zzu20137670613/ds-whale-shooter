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
 * Eight-way aim from the direction she is WALKING, in keyboard mode.
 *
 * The owner: `键盘模式的攻击方向依旧跟着鼠标…攻击方向实际上应该跟随移动的八项`. Movement is
 * WASD, so the shot has to come off the same intent that moves her - otherwise aim and feet
 * are two different things and neither reads as control.
 *
 * Null while standing still: the caller keeps the previous direction rather than snapping
 * back to east, which is what a player who let go of the keys expects.
 */
export function aimFromMoveIntent(intent: { vx: number; vy: number }): AimVector | null {
    const x = Math.abs(intent.vx) < 1e-6 ? 0 : Math.sign(intent.vx);
    const y = Math.abs(intent.vy) < 1e-6 ? 0 : Math.sign(intent.vy);
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
 * The aim point for keyboard mode, measured from her HANDS rather than her feet.
 *
 * The owner: `6向都对，左右有点问题，不是水平的左右，都是稍微偏下的`. Bullets leave the
 * muzzle, which sits `handUp` pixels above the body centre, while the aim point was built from
 * the body centre - so an east shot ran from a higher point down to a line through her waist
 * and tipped down by atan(handUp / range). Diagonals hid it; due left and right did not.
 */
export function directionalAimPoint(
    bodyPosition: { x: number; y: number },
    handUp: number,
    direction: AimVector,
    range = 600,
): { x: number; y: number } {
    return aimPointFrom(
        { x: bodyPosition.x, y: bodyPosition.y - handUp },
        direction,
        range,
    );
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