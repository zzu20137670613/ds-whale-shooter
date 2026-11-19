import { describe, expect, it } from 'vitest';

import {
    SAMPLE_REACH,
    candidateCells,
    pointInPolygon,
    rasterizeWalls,
    subGrid,
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

describe('windowed rasterization', () => {
    it('marks exactly what the full grid marks in the same region', () => {
        // The guarantee the camera-local grid rests on: a grid windowed at a
        // whole number of cells must produce the cells the full grid produces
        // there. Compared over the interior only — a buffer cell on the window's
        // very border can belong to a wall just outside the window, which the
        // window cannot see. That border is off camera by the margin, and the
        // next rebuild covers it.
        const walls = [
            square(320, 320, 96),
            triangle(900, 200, 1000, 420, 860, 460),
            square(1400, 1200, 160),
        ];
        const full = rasterizeWalls(16, 200, 120, walls);

        const originX = 480; // cell 30
        const originY = 240; // cell 15
        const window = rasterizeWalls(16, 60, 40, walls, originX, originY);

        for (let gy = 1; gy < 39; gy++) {
            for (let gx = 1; gx < 59; gx++) {
                expect(window[gy][gx]).toBe(full[originY / 16 + gy][originX / 16 + gx]);
            }
        }
    });

    it('shifts which cells a wall lands on when the origin moves', () => {
        const wall = square(500, 500, 48);
        // The same wall sits at cell 31 with no origin, and at cell 1 once the
        // window starts one cell earlier.
        expect(rasterizeWalls(16, 40, 40, [wall])[31][31]).toBe(1);
        expect(rasterizeWalls(16, 40, 40, [wall], 480, 480)[1][1]).toBe(1);
    });
});

describe('subGrid', () => {
    it('cuts the requested region out of a larger grid', () => {
        const grid = [
            [0, 1, 2, 3],
            [4, 5, 6, 7],
            [8, 9, 10, 11],
        ];
        expect(subGrid(grid, 1, 1, 2, 2)).toEqual([
            [5, 6],
            [9, 10],
        ]);
    });

    it('pads with walkable cells past the source bounds', () => {
        const grid = [
            [1, 2],
            [3, 4],
        ];
        expect(subGrid(grid, 1, 1, 2, 2)).toEqual([
            [4, 0],
            [0, 0],
        ]);
    });

    it('is exactly what rasterizing that window directly produces', () => {
        // The property the camera-local easystar rests on: slicing a full grid
        // and rasterizing the same window from scratch must agree. The walls sit
        // well clear of the window edges, so no buffer cell depends on a wall
        // the window cannot see.
        const walls = [square(560, 336, 96), triangle(900, 400, 1000, 620, 860, 660)];
        const full = rasterizeWalls(16, 200, 120, walls);

        expect(subGrid(full, 30, 15, 60, 40)).toEqual(rasterizeWalls(16, 60, 40, walls, 480, 240));
    });
});