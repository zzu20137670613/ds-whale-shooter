/**
 * src/lib/nav/raster.ts
 * --------------------------------------------------------------------------
 * Turning level wall polygons into the monster pathfinding grid.
 *
 * Pure — no Phaser, no scene — so the grid can be diffed against a brute-force
 * reference in tests. The service owns the easystar side; this owns "which
 * cells are wall".
 *
 * Performance note: testing every cell against every wall is O(walls x cells).
 * On a 9x9 map (1,337,472 cells) that measured 163 seconds for 1080 walls, and
 * 1.55 seconds for just 12. Each wall is therefore only tested against the
 * cells its own bounding box can reach: the sample points sit within
 * SAMPLE_REACH of the cell centre, so growing the box by that much cannot skip
 * a cell the full scan would have marked. Both passes produce identical grids —
 * tests/lib/nav/raster.test.ts proves it against a brute-force scan.
 */

/** 1 = wall, 2 = one-cell safety buffer, 0 = walkable. */
export type WallGrid = number[][];

/** How far the sample points sit from the cell centre, as a fraction of half a cell. */
export const SAMPLE_REACH = 0.7;

export interface PolygonWall {
    points: readonly [number, number][];
}

/** The cell range a polygon can touch, inclusive, clipped to the grid. */
export interface CellRange {
    minGx: number;
    maxGx: number;
    minGy: number;
    maxGy: number;
}

/** Simple point-in-polygon check (ray casting). */
export function pointInPolygon(px: number, py: number, poly: readonly [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0],
            yi = poly[i][1];
        const xj = poly[j][0],
            yj = poly[j][1];
        const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Cells a polygon can possibly touch: its bounding box grown by the sample
 * reach, clipped to the grid. Null when that box misses the grid, or when the
 * polygon is too small to enclose anything.
 */
export function candidateCells(
    points: readonly [number, number][],
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
): CellRange | null {
    if (points.length < 3) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }

    // A cell is sampled at worldX = gx * cellSize + half, plus up to `reach`.
    const half = cellSize / 2;
    const reach = half * SAMPLE_REACH;
    const minGx = Math.max(0, Math.floor((minX - reach - half) / cellSize));
    const maxGx = Math.min(gridWidth - 1, Math.floor((maxX + reach - half) / cellSize));
    const minGy = Math.max(0, Math.floor((minY - reach - half) / cellSize));
    const maxGy = Math.min(gridHeight - 1, Math.floor((maxY + reach - half) / cellSize));

    if (minGx > maxGx || minGy > maxGy) return null;
    return { minGx, maxGx, minGy, maxGy };
}

/** The five points sampled per cell: its centre plus four corners. */
function sampleOffsets(half: number): { x: number; y: number }[] {
    const d = half * SAMPLE_REACH;
    return [
        { x: 0, y: 0 },
        { x: -d, y: -d },
        { x: d, y: -d },
        { x: -d, y: d },
        { x: d, y: d },
    ];
}

/**
 * Build the walkable / wall / buffer grid. Same result as scanning every cell
 * against every wall, without paying for the empty space between them.
 */
export function rasterizeWalls(
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
    walls: readonly PolygonWall[],
): WallGrid {
    const half = cellSize / 2;
    const offsets = sampleOffsets(half);
    const grid: WallGrid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    const boxes: (CellRange | null)[] = walls.map((wall) =>
        candidateCells(wall.points, cellSize, gridWidth, gridHeight),
    );

    // 1. Solid walls (value 1).
    walls.forEach((wall, index) => {
        const box = boxes[index];
        if (!box) return;
        for (let gy = box.minGy; gy <= box.maxGy; gy++) {
            const worldY = gy * cellSize + half;
            for (let gx = box.minGx; gx <= box.maxGx; gx++) {
                const worldX = gx * cellSize + half;
                for (const off of offsets) {
                    if (pointInPolygon(worldX + off.x, worldY + off.y, wall.points)) {
                        grid[gy][gx] = 1;
                        break;
                    }
                }
            }
        }
    });

    // 2. One-cell safety buffer (value 2) around solid walls. Only cells next to
    // a wall cell qualify, and wall cells live inside their own box, so the
    // grown box covers every candidate.
    walls.forEach((_wall, index) => {
        const box = boxes[index];
        if (!box) return;
        const minGy = Math.max(0, box.minGy - 1);
        const maxGy = Math.min(gridHeight - 1, box.maxGy + 1);
        const minGx = Math.max(0, box.minGx - 1);
        const maxGx = Math.min(gridWidth - 1, box.maxGx + 1);
        for (let gy = minGy; gy <= maxGy; gy++) {
            for (let gx = minGx; gx <= maxGx; gx++) {
                if (grid[gy][gx] !== 0) continue;
                if (hasWallNeighbour(grid, gx, gy, gridWidth, gridHeight)) {
                    grid[gy][gx] = 2;
                }
            }
        }
    });

    return grid;
}

function hasWallNeighbour(
    grid: WallGrid,
    gx: number,
    gy: number,
    gridWidth: number,
    gridHeight: number,
): boolean {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = gy + dy;
            const nx = gx + dx;
            if (ny < 0 || ny >= gridHeight || nx < 0 || nx >= gridWidth) continue;
            if (grid[ny][nx] === 1) return true;
        }
    }
    return false;
}