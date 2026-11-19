/**
 * src/lib/combat/melee-arc.ts
 * --------------------------------------------------------------------------
 * Where a melee swing lands, in eight directions instead of two.
 *
 * The owner: `人物的近战武器只有左右两个方向的攻击` - and, after I mapped it,
 * `方案 A：判定改 8 向`.
 *
 * The hit box used to be pinned to the attacker's left or right: `y` never
 * moved and the rectangle was never rotated, so a swing aimed up-left drew a
 * diagonal arc (the procedural visual already rotates) and then hit nothing.
 * These two helpers are the whole fix, kept pure so they can be tested without
 * a Phaser scene:
 *
 *   `snapMeleeAngle`      - quantise the aim to the 8 sectors
 *   `meleeHitboxPlacement` - centre and rotation for the sensor rectangle
 */

/** Eight directions: 0, 45, ... 315 degrees. */
export const MELEE_SECTORS = 8;

/** Radians between two neighbouring swing directions. */
export const MELEE_SECTOR_STEP = (Math.PI * 2) / MELEE_SECTORS;

/**
 * Round an aim angle onto the nearest of the eight sectors.
 *
 * Boundaries fall on the odd multiples of 22.5 degrees and always round AWAY
 * from zero ( `Math.round` ), which keeps a dead-straight right aim at 0
 * instead of flipping it to 45.
 */
export function snapMeleeAngle(aimRadians: number): number {
    if (!Number.isFinite(aimRadians)) return 0;
    const sector = Math.round(aimRadians / MELEE_SECTOR_STEP);
    // Wrap once so the result stays in (-PI, PI]: a sprite rotated by 7.5pi
    // looks the same as one rotated by -0.5pi, but tests and debug readouts
    // are much easier when the angle is canonical.
    // Wrap arithmetically instead of through sin/cos: trigonometry drags in
    // floating-point dust (-7e-16 for a full turn), and `deg()` of that reads as
    // `-0`. A modular wrap keeps exact multiples exact.
    const TWO_PI = Math.PI * 2;
    const snapped = sector * MELEE_SECTOR_STEP;
    const wrapped = (((snapped + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI - Math.PI;
    // (-PI, PI] is the canonical window, so a half turn reads as +PI.
    return wrapped === -Math.PI ? Math.PI : wrapped + 0;
}

export interface MeleeHitboxPlacement {
    /** Centre of the sensor rectangle. */
    x: number;
    y: number;
    /** Rotation for both the sensor body and the swing visual. */
    angle: number;
}

/**
 * The sensor rectangle's centre and rotation for one swing.
 *
 * The box keeps its old geometry (a `hitWidth` x `hitHeight` rectangle whose
 * near edge starts at the attacker), it is simply pushed out along the swing
 * direction and rotated to match, so the far edge still reaches `range`.
 */
export function meleeHitboxPlacement(
    origin: { x: number; y: number },
    aimRadians: number,
    range: number,
    hitWidth: number,
): MeleeHitboxPlacement {
    const angle = snapMeleeAngle(aimRadians);
    const sideOffset = Math.max(0, range - hitWidth / 2);
    return {
        x: origin.x + Math.cos(angle) * sideOffset,
        y: origin.y + Math.sin(angle) * sideOffset,
        angle,
    };
}