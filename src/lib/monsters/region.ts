/**
 * src/lib/monsters/region.ts
 * --------------------------------------------------------------------------
 * Follow-spawn geometry: where a wave comes from.
 *
 * The level splits into quadrants at half width / half height. Entering one of
 * the first three spawns nine monsters - four on screen around the player, five
 * hugging that quadrant's edges - and they walk in. Pure maths only: the caller
 * owns the scene, the RNG's real randomness and the wall checks.
 */

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

/** Where a wave slot comes from. */
export interface WaveSlot {
    distance: 'near' | 'far';
    role: 'melee' | 'ranged';
}

/**
 * Split a map into quadrants: top-left, top-right, bottom-left, bottom-right.
 *
 * Odd sizes put the extra pixel in the first row/column so the four rectangles
 * always tile the map exactly, with no gap and no overlap.
 */
export function quadrantRects(width: number, height: number): Rect[] {
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const widths = [halfW, width - halfW];
    const heights = [halfH, height - halfH];

    const rects: Rect[] = [];
    for (const [rowIndex, top] of [0, halfH].entries()) {
        for (const [colIndex, left] of [0, halfW].entries()) {
            rects.push({
                x: left,
                y: top,
                width: widths[colIndex],
                height: heights[rowIndex],
            });
        }
    }
    return rects;
}

/** Index of the quadrant holding `(x, y)`, or -1 outside the map. */
export function quadrantIndexAt(x: number, y: number, rects: readonly Rect[]): number {
    for (let index = 0; index < rects.length; index++) {
        const rect = rects[index];
        const insideX = x >= rect.x && x < rect.x + rect.width;
        const insideY = y >= rect.y && y < rect.y + rect.height;
        if (insideX && insideY) return index;
    }
    return -1;
}

/**
 * `count` points spread along the quadrant's perimeter, `inset` px inside it.
 *
 * Walking the perimeter and taking evenly spaced fractions spreads the points
 * over all four sides for free - five points land roughly top, top, right/bottom,
 * bottom, left - which is the "1-2 per side" the owner asked for, without a
 * per-side special case.
 */
export function edgeSpawnPoints(rect: Rect, count: number, inset: number): Point[] {
    if (count <= 0) return [];

    const left = rect.x + inset;
    const top = rect.y + inset;
    const right = rect.x + rect.width - inset;
    const bottom = rect.y + rect.height - inset;
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return [];

    const perimeter = 2 * (width + height);
    const points: Point[] = [];
    for (let index = 0; index < count; index++) {
        let distance = ((index + 0.5) / count) * perimeter;
        // clockwise from the top-left corner
        if (distance <= width) {
            points.push({ x: left + distance, y: top });
            continue;
        }
        distance -= width;
        if (distance <= height) {
            points.push({ x: right, y: top + distance });
            continue;
        }
        distance -= height;
        if (distance <= width) {
            points.push({ x: right - distance, y: bottom });
            continue;
        }
        distance -= width;
        points.push({ x: left, y: bottom - Math.min(distance, height) });
    }
    return points;
}

/**
 * `count` points in a ring around the player, one per evenly spaced direction so
 * a wave never arrives from a single side.
 *
 * `rng` is injected: the game passes `Math.random`, tests pass a constant. Each
 * direction gets a random radius inside `[minDistance, maxDistance]`.
 */
export function nearRingPoints(
    count: number,
    player: Point,
    minDistance: number,
    maxDistance: number,
    rng: () => number,
): Point[] {
    if (count <= 0) return [];
    const span = Math.max(0, maxDistance - minDistance);
    const points: Point[] = [];
    for (let index = 0; index < count; index++) {
        // Half-step offset so a four-point ring lands in the four diagonals
        // instead of exactly on the axes (which would put two of them on the
        // player's centre lines and read as "two came from the same side").
        const angle = ((index + 0.5) / count) * Math.PI * 2;
        const radius = minDistance + rng() * span;
        points.push({
            x: player.x + Math.cos(angle) * radius,
            y: player.y + Math.sin(angle) * radius,
        });
    }
    return points;
}

/**
 * The fixed shape of one wave: four near (2 melee + 2 ranged) and five far
 * (2 melee + 3 ranged). Order is near-first so the caller can spawn the close
 * threats before the walk-ins.
 */
export function waveComposition(): WaveSlot[] {
    return [
        { distance: 'near', role: 'melee' },
        { distance: 'near', role: 'ranged' },
        { distance: 'near', role: 'melee' },
        { distance: 'near', role: 'ranged' },
        { distance: 'far', role: 'melee' },
        { distance: 'far', role: 'ranged' },
        { distance: 'far', role: 'melee' },
        { distance: 'far', role: 'ranged' },
        { distance: 'far', role: 'ranged' },
    ];
}