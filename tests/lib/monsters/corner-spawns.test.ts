/**
 * tests/lib/monsters/corner-spawns.test.ts
 * --------------------------------------------------------------------------
 * Far waves do not spawn in the corner of the painting.
 *
 * The owner: `亚特兰蒂斯有怪刷到了角落里` - one monster, last on the map, standing in open water
 * at the top-right of the screen under the HUD. The cause was geometry: `edgeSpawnPoints` walks
 * a quadrant's perimeter, and on an outer quadrant two sides ARE the map border, so a point can
 * land in the very corner.
 */

import { describe, expect, it } from 'vitest';

import { pullFromWorldCorners } from '@/lib/monsters/region';

const SIZE = { width: 11008, height: 6144 };
const INSET = 900;

describe('pullFromWorldCorners', () => {
    it('leaves a point in the middle of the map alone', () => {
        const p = { x: 5504, y: 3072 };
        expect(pullFromWorldCorners(p, SIZE, INSET)).toEqual(p);
    });

    it('is a no-op at inset 0, which is every other level', () => {
        const p = { x: 30, y: 30 };
        expect(pullFromWorldCorners(p, SIZE, 0)).toEqual(p);
    });

    it('moves a top-left corner point away from the corner', () => {
        const out = pullFromWorldCorners({ x: 480, y: 480 }, SIZE, INSET);
        expect(Math.hypot(out.x, out.y)).toBeGreaterThan(Math.hypot(480, 480));
        // It slides along an edge, so one coordinate stays put.
        expect(out.x === 480 || out.y === 480).toBe(true);
    });

    it('moves a top-right corner point too - the one he caught', () => {
        const out = pullFromWorldCorners({ x: 10600, y: 300 }, SIZE, INSET);
        // No longer inside BOTH border bands: one axis has been pushed clear.
        const nearX = out.x < INSET || out.x > SIZE.width - INSET;
        const nearY = out.y < INSET || out.y > SIZE.height - INSET;
        expect(nearX && nearY).toBe(false);
    });

    it('moves bottom corners as well', () => {
        for (const p of [
            { x: 200, y: 6000 },
            { x: 10800, y: 5900 },
        ]) {
            const out = pullFromWorldCorners(p, SIZE, INSET);
            const nearX = out.x < INSET || out.x > SIZE.width - INSET;
            const nearY = out.y < INSET || out.y > SIZE.height - INSET;
            expect(nearX && nearY, `${p.x},${p.y} is still in a corner`).toBe(false);
        }
    });

    it('slides along the edge it is hugging, never diagonally into the map', () => {
        const out = pullFromWorldCorners({ x: 10900, y: 600 }, SIZE, INSET);
        // Hugging the top edge (600 into it) more than the right (108), so it slides DOWN and
        // keeps its x - the point stays on the artist's water line instead of cutting across.
        expect(out.x).toBe(10900);
        expect(out.y).toBe(INSET);
    });
});

describe('the Atlantis configuration', () => {
    it('asks for both a border inset and a corner inset', async () => {
        const { readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const { parseLevelYaml } = await import('@/lib/levels/parser');
        const level = parseLevelYaml(
            readFileSync(
                join(process.cwd(), 'public', 'data', 'levels', 'dsh-atlantis-4-coronation-dais.yaml'),
                'utf8',
            ),
            'dsh-atlantis-4-coronation-dais',
        );
        expect(level.spawner!.far.edgeInset).toBeGreaterThanOrEqual(400);
        expect(level.spawner!.far.cornerInset).toBeGreaterThanOrEqual(600);
    });
});