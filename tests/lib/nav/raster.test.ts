import { describe, expect, it } from 'vitest';

import {
    SAMPLE_REACH,
    candidateCells,
    pointInPolygon,
    rasterizeWalls,
    type PolygonWall,
} from '@/lib/nav/raster';

function square(x: number, y: number, size: number): PolygonWall {
    return {
        points: [
            [x, y],
            [x + size, y],
            [x + size, y + size],
            [x, y + size],
        ],
    };
}

function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): PolygonWall {
    return {
        points: [
            [ax, ay],
            [bx, by],
            [cx, cy],
        ],
    };
}

/**
 * The reference implementation: every cell against every wall, then a full
 * sweep for buffers. This is exactly what the service did before the bounding
 * box optimisation, kept here so the fast path can be proven identical rather
 * than assumed. It shares `pointInPolygon`, so what it checks is the claim that
 * actually matters — the boxes skip no cell the full scan would have marked.
 */
function bruteForce(
    cellSize: number,
    gridWidth: number,
    gridHeight: number,
    walls: readonly PolygonWall[],
): number[][] {
    const half = cellSize / 2;
    const d = half * SAMPLE_REACH;
    const offsets = [
        { x: 0, y: 0 },
        { x: -d, y: -d },
        { x: d, y: -d },
        { x: -d, y: d },
        { x: d, y: d },
    ];

    const grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    for (let gy = 0; gy < gridHeight; gy++) {
        const worldY = gy * cellSize + half;
        for (let gx = 0; gx < gridWidth; gx++) {
            const worldX = gx * cellSize + half;
            let blocked = false;
            for (const wall of walls) {
                if (wall.points.length < 3) continue;
                for (const off of offsets) {
                    if (pointInPolygon(worldX + off.x, worldY + off.y, wall.points)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) break;
            }
            if (blocked) grid[gy][gx] = 1;
        }
    }

    for (let gy = 0; gy < gridHeight; gy++) {
        for (let gx = 0; gx < gridWidth; gx++) {
            if (grid[gy][gx] === 1) continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const ny = gy + dy;
                    const nx = gx + dx;
                    if (ny < 0 || ny >= gridHeight || nx < 0 || nx >= gridWidth) continue;
                    if (grid[ny][nx] === 1) {
                        near = true;
                        break;
                    }
                }
            }
            if (near) grid[gy][gx] = 2;
        }
    }

    return grid;
}

describe('rasterizeWalls', () => {
    it('matches the brute-force scan on a mixed set of walls', () => {
        const walls = [
            square(48, 48, 80),
            triangle(200, 60, 260, 140, 190, 150),
            square(400, 400, 16),
            square(-40, -40, 60),
        ];
        expect(rasterizeWalls(16, 40, 30, walls)).toEqual(bruteForce(16, 40, 30, walls));
    });

    it('matches at the current level size', () => {
        // 172x96 is one screen at 16px — the grid the game runs on today.
        const walls = [
            square(600, 300, 96),
            square(1500, 900, 200),
            triangle(2400, 1200, 2700, 1300, 2450, 1500),
            square(2740, 20, 40),
        ];
        expect(rasterizeWalls(16, 172, 96, walls)).toEqual(bruteForce(16, 172, 96, walls));
    });

    it('marks a wall as solid and its surroundings as buffer', () => {
        const grid = rasterizeWalls(16, 20, 20, [square(80, 80, 48)]);
        expect(grid[5][5]).toBe(1);
        expect(grid[4][5]).toBe(2);
        expect(grid[0][0]).toBe(0);
    });

    it('ignores a polygon with fewer than three points', () => {
        const grid = rasterizeWalls(16, 10, 10, [{ points: [[0, 0], [5, 5]] }]);
        expect(grid.flat().every((value) => value === 0)).toBe(true);
    });

    it('produces an all-walkable grid when there are no walls', () => {
        expect(rasterizeWalls(16, 4, 3, []).flat().every((v) => v === 0)).toBe(true);
    });
});

describe('candidateCells', () => {
    it('only claims the cells one small wall can reach', () => {
        // The performance claim as a property: a 96px wall in a 1000x1000 grid
        // touches a handful of cells, not a million.
        const box = candidateCells(square(5000, 5000, 96).points, 16, 1000, 1000);
        expect(box).not.toBeNull();
        const width = box!.maxGx - box!.minGx + 1;
        const height = box!.maxGy - box!.minGy + 1;
        expect(width * height).toBeLessThan(100);
    });

    it('clips a wall that hangs off the grid edge', () => {
        const box = candidateCells(square(-50, -50, 100).points, 16, 20, 20);
        expect(box).toEqual({ minGx: 0, maxGx: 2, minGy: 0, maxGy: 2 });
    });

    it('returns null when the wall is off the grid entirely', () => {
        expect(candidateCells(square(10_000, 10_000, 32).points, 16, 20, 20)).toBeNull();
    });

    it('returns null for a degenerate polygon', () => {
        expect(candidateCells([[0, 0]], 16, 20, 20)).toBeNull();
    });
});

describe('pointInPolygon', () => {
    const poly: [number, number][] = [
        [10, 10],
        [50, 10],
        [50, 50],
        [10, 50],
    ];

    it('separates inside from outside', () => {
        expect(pointInPolygon(30, 30, poly)).toBe(true);
        expect(pointInPolygon(5, 30, poly)).toBe(false);
        expect(pointInPolygon(30, 80, poly)).toBe(false);
    });

    it('treats an empty polygon as empty', () => {
        expect(pointInPolygon(0, 0, [])).toBe(false);
    });
});