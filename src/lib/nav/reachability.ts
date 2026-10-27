/**
 * src/lib/nav/reachability.ts
 * --------------------------------------------------------------------------
 * Which floor cells a walking body can actually get to.
 *
 * "Not a wall" is not the same as "reachable". A library can have a room that is
 * walled off on all four sides: its floor cells pass a wall test and are
 * impossible to enter or leave. Spawning a monster there strands it against a
 * bookshelf forever, which is exactly the bug a player reports as "the last
 * monster never comes".
 *
 * So a follow-spawn point must pass both tests: wall-free AND in the same
 * connected region as the player. `buildReachability` flood-fills once per level
 * from the player's starting cell; `nearestReachable` then helps a rejected point
 * find its way out instead of being dropped.
 *
 * Pure: no Phaser, no easystar, just a grid walk. 4-way movement only, because a
 * body cannot slip through a corner where two walls meet diagonally.
 */

/** `1` = wall, anything else = floor (see `raster.ts`). */
export type NavGrid = ReadonlyArray<ReadonlyArray<number>>;

/** One byte per cell: 1 = reachable from the origin. */
export type ReachabilityMask = Uint8Array;

/**
 * Flood the walkable cells connected to `(originX, originY)`.
 *
 * Returns `null` when nothing walkable exists near the origin (a fully walled
 * map), which callers treat as "no valid spawn anywhere".
 */
export function buildReachability(
    grid: NavGrid,
    originX: number,
    originY: number,
): ReachabilityMask | null {
    const height = grid.length;
    if (height === 0) return null;
    const width = grid[0].length;
    if (width === 0) return null;

    const start = findWalkableNear(grid, originX, originY);
    if (!start) return null;

    const mask = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const startIndex = start.y * width + start.x;
    mask[startIndex] = 1;
    queue[tail++] = startIndex;

    while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const y = (index - x) / width;

        // 4-way: diagonal moves would squeeze through corners real bodies cannot.
        const neighbours = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
        ];
        for (const [nx, ny] of neighbours) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nextIndex = ny * width + nx;
            if (mask[nextIndex]) continue;
            if (grid[ny][nx] === 1) continue;
            mask[nextIndex] = 1;
            queue[tail++] = nextIndex;
        }
    }

    return mask;
}

/** Whether a cell is in the flooded region. Out-of-bounds counts as unreachable. */
export function isReachable(
    mask: ReachabilityMask,
    x: number,
    y: number,
    width: number,
): boolean {
    if (x < 0 || y < 0) return false;
    const index = y * width + x;
    if (index < 0 || index >= mask.length) return false;
    return mask[index] === 1;
}

/**
 * The closest reachable cell to `(x, y)`, searching outward ring by ring.
 *
 * `maxRadius` caps the search so a point sealed deep inside a wall picks the
 * nearest edge of its room rather than teleporting across the map.
 */
export function nearestReachable(
    mask: ReachabilityMask,
    x: number,
    y: number,
    width: number,
    height: number,
    maxRadius: number,
): { x: number; y: number } | null {
    if (isReachable(mask, x, y, width)) return { x, y };

    for (let radius = 1; radius <= maxRadius; radius++) {
        let best: { x: number; y: number } | null = null;
        let bestDistance = Infinity;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                // only the ring itself, so a nearer hit is found first
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (!isReachable(mask, nx, ny, width)) continue;
                const distance = dx * dx + dy * dy;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = { x: nx, y: ny };
                }
            }
        }

        if (best) return best;
    }

    return null;
}

/** Expand out from a blocked origin until a floor cell turns up. */
function findWalkableNear(
    grid: NavGrid,
    originX: number,
    originY: number,
): { x: number; y: number } | null {
    const height = grid.length;
    const width = grid[0].length;
    const limit = Math.max(width, height);

    for (let radius = 0; radius <= limit; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (radius > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
                const x = originX + dx;
                const y = originY + dy;
                if (x < 0 || y < 0 || x >= width || y >= height) continue;
                if (grid[y][x] !== 1) return { x, y };
            }
        }
    }
    return null;
}