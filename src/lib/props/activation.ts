/**
 * src/lib/props/activation.ts
 * --------------------------------------------------------------------------
 * Which world objects are near enough the camera to be worth updating.
 *
 * Pure — the camera rectangle and each object's box arrive as plain numbers —
 * so the rule is testable without Phaser and can be shared by props, drops and
 * monsters alike.
 *
 * Why it exists: Phaser culls tilemap layers but not ordinary sprites, and the
 * per-frame work a player never sees (y-sorting, body wakes, animation ticks)
 * is what a 9x9 world would drown in. The rule the big map is built on: world
 * size stays free, active content stays constant.
 */

/** An axis-aligned box in world pixels, about an object's anchor. */
export interface Box {
    x: number;
    y: number;
    /** Half-extents, already including scale. */
    halfWidth: number;
    halfHeight: number;
}

/** A rectangle in world pixels — `Phaser.Geom.Rectangle` satisfies this. */
export interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/**
 * Default slack, in pixels.
 *
 * Two jobs: art that extends well past its anchor (a palm's fronds reach
 * hundreds of pixels from the trunk) stays active while that anchor is still
 * off-view, and objects near the border do not flicker on and off. Erring
 * generous is nearly free — one extra visible sprite costs nothing, whereas
 * one missing sprite is a visible pop.
 */
export const DEFAULT_ACTIVATION_MARGIN = 512;

/**
 * True when `box`, grown by `margin`, overlaps `view`. Touching the boundary
 * counts, so there is no one-frame hole exactly at the edge.
 */
export function isWithinView(box: Box, view: Rect, margin = DEFAULT_ACTIVATION_MARGIN): boolean {
    return (
        box.x + box.halfWidth + margin >= view.left &&
        box.x - box.halfWidth - margin <= view.right &&
        box.y + box.halfHeight + margin >= view.top &&
        box.y - box.halfHeight - margin <= view.bottom
    );
}