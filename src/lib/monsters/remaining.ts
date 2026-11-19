/**
 * src/lib/monsters/remaining.ts
 * --------------------------------------------------------------------------
 * "How many monsters are left on this map", as a number the HUD can print.
 *
 * The owner: `在右上角连击数的下方位置添加一行：剩余怪物数：X  X跟随地图上剩余怪物数实时变化`.
 *
 * The controller already knows the answer every frame - it is the same list it walks to draw
 * them - so the HUD does not poll anything; it subscribes to one event and prints what it is
 * told. Only changes are published, so a quiet map costs nothing.
 */

export const MONSTERS_REMAINING_EVENT = 'monsters:remaining';

export interface MonstersRemainingPayload {
    count: number;
}

/**
 * Monsters that still count as "left": alive, not in their death animation, not props.
 *
 * A dying monster is already beaten - counting it would make the last kill look like it did
 * not register.
 */
export function remainingCount(
    monsters: readonly { dead?: boolean; state?: string; spec?: { prop?: boolean } }[],
): number {
    return monsters.filter((m) => !m.dead && m.state !== 'dying' && !m.spec?.prop).length;
}

/**
 * Pending spawns count too: a wave that has been queued but not placed yet still belongs to
 * the map, and showing 0 for two seconds while nine monsters materialise reads as a bug.
 */
export function remainingWithPending(remaining: number, pending: number): number {
    return Math.max(0, remaining + Math.max(0, pending));
}
/** At or below this many monsters, the HUD starts pointing at them. */
export const POINTER_THRESHOLD = 3;

export interface PointLike {
    x: number;
    y: number;
}

/**
 * The nearest monster still worth walking to, or null when none is left.
 *
 * "Worth walking to" is the same rule the counter uses: dead, dying and scenery do not count.
 * Ties go to the first in the list, which is the oldest spawn - it has been waiting longest.
 */
export function nearestMonster(
    player: PointLike,
    monsters: readonly (PointLike & { dead?: boolean; state?: string; spec?: { prop?: boolean } })[],
): (PointLike & { distance: number }) | null {
    let best: (PointLike & { distance: number }) | null = null;
    for (const m of monsters) {
        if (m.dead || m.state === 'dying' || m.spec?.prop) continue;
        const distance = Math.hypot(m.x - player.x, m.y - player.y);
        if (!best || distance < best.distance) best = { x: m.x, y: m.y, distance };
    }
    return best;
}
