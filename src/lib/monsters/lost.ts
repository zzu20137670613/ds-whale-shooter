/**
 * src/lib/monsters/lost.ts
 * --------------------------------------------------------------------------
 * When a monster should be written off.
 *
 * The exit portal and the mysterious merchant open on `isAllCleared()`, which counts every
 * monster that is not dead. One monster spawned onto the lip of a floating platform, or one
 * wedged inside a wall the player cannot walk behind, therefore closes the level forever: the
 * owner cleared three waves in the sky city, found no monsters, and no portal appeared.
 *
 * Two facts decide it, and neither can be true of a monster the player can still fight:
 *   - it is outside the painted world (nothing to stand on out there), or
 *   - it has been far away and nobody has come near it for a long time.
 */

export const WORLD_MARGIN_PX = 64;
/** Closer than this counts as "the fight is here". */
export const ABANDON_DISTANCE_PX = 3000;
/** How long a far-away monster is left alone before it is written off. */
export const ABANDON_AFTER_MS = 45_000;

/** True when this point is past the painted map, where no floor exists. */
export function isOutsideWorld(
    pos: { x: number; y: number },
    world: { width: number; height: number },
    margin = WORLD_MARGIN_PX,
): boolean {
    return (
        pos.x < -margin ||
        pos.y < -margin ||
        pos.x > world.width + margin ||
        pos.y > world.height + margin
    );
}

/** True when a monster has been left far behind for long enough to count as lost. */
export function isAbandoned(
    distancePx: number,
    timeOutOfRangeMs: number,
    maxDistance = ABANDON_DISTANCE_PX,
    afterMs = ABANDON_AFTER_MS,
): boolean {
    return distancePx > maxDistance && timeOutOfRangeMs >= afterMs;
}
