/**
 * src/game/scenes/logic.ts
 * --------------------------------------------------------------------------
 * Pure decisions extracted out of `scene.ts` / `teleporter.ts` so they can be
 * tested without a Phaser scene.
 */

/** A portal spec as authored in a level's `teleporters:` block. */
export interface PortalSpec {
    id?: string;
    x: number;
    y: number;
    radius?: number;
}

/** Fallback trigger radius — mirrors the `?? 40` used in `teleporter.ts`. */
const DEFAULT_RADIUS = 40;

/**
 * Ids of the portals whose trigger radius already contains the player.
 *
 * Used on the first frame the player body exists. A portal can be armed from
 * the start — the level is already clear, or (as in `sunlit-henge`) the return
 * portal is authored nine pixels from the spawn point — and being armed must
 * not teleport someone who never walked into it. Those ids join the same
 * "leave the radius to release" cooldown as the portal the player arrived
 * through.
 *
 * Portals with no id are skipped: the cooldown set is keyed by id.
 */
export function portalsContaining(
    player: { x: number; y: number },
    portals: readonly PortalSpec[],
): string[] {
    const held: string[] = [];
    for (const portal of portals) {
        if (!portal.id) continue;
        const radius = portal.radius ?? DEFAULT_RADIUS;
        if (Math.hypot(player.x - portal.x, player.y - portal.y) <= radius) {
            held.push(portal.id);
        }
    }
    return held;
}