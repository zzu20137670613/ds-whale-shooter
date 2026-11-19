/**
 * tests/lib/levels/library-entrance-exclusion.test.ts
 * --------------------------------------------------------------------------
 * 星空图书馆入口关：右上角那片星空不刷怪。
 *
 * 主人 2026-11-13：`星空图书馆入口关有怪刷到右上角了，将这个角落刷怪禁掉，只让刷到其他位置`。
 *
 * The far slots walk the quadrant's perimeter, so on the top-right quadrant two of them land in
 * the starry void above the torn floor edge. This file replays the spawner's own placement
 * arithmetic against the level data and asserts every far point ends up out of that corner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import { edgeSpawnPoints } from '@/lib/monsters/region';

const ID = 'starry-library-1-entrance';

const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${ID}.yaml`), 'utf8'),
    ID,
);

/** The spawner pushes a point to the nearest edge of a no-spawn rectangle (see region-spawner). */
const EXCLUSION_MARGIN_PX = 24;

function outside(point: { x: number; y: number }): { x: number; y: number } {
    const zones = level.spawner?.exclude ?? [];
    const { width, height } = level.imageSize;
    let out = point;
    for (const zone of zones) {
        const inside =
            out.x >= zone.x &&
            out.x <= zone.x + zone.width &&
            out.y >= zone.y &&
            out.y <= zone.y + zone.height;
        if (!inside) continue;
        const exits = [
            { x: out.x, y: zone.y + zone.height + EXCLUSION_MARGIN_PX },
            { x: out.x, y: zone.y - EXCLUSION_MARGIN_PX },
            { x: zone.x - EXCLUSION_MARGIN_PX, y: out.y },
            { x: zone.x + zone.width + EXCLUSION_MARGIN_PX, y: out.y },
        ].filter((p) => p.y > 16 && p.y < height - 16 && p.x > 16 && p.x < width - 16);
        const distance = (p: { x: number; y: number }): number =>
            Math.abs(p.x - out.x) + Math.abs(p.y - out.y);
        exits.sort((a, b) => distance(a) - distance(b));
        if (exits[0]) out = exits[0];
    }
    return out;
}

const inZone = (
    x: number,
    y: number,
    zone: { x: number; y: number; width: number; height: number },
) => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;

describe('the top-right corner of the library entrance', () => {
    it('is authored as a no-spawn rectangle', () => {
        const zones = level.spawner?.exclude ?? [];
        expect(zones.length).toBeGreaterThan(0);
        // The corner itself: the right-hand end of the plate's top band.
        const corner = { x: level.imageSize.width - 1200, y: 0, width: 1200, height: 600 };
        expect(zones.some((zone) => inZone(corner.x + 100, 100, zone))).toBe(true);
    });

    it('no far slot of the top-right quadrant survives inside it', () => {
        const spawner = level.spawner!;
        const quad = {
            x: level.imageSize.width / 2,
            y: 0,
            width: level.imageSize.width / 2,
            height: level.imageSize.height / 2,
        };
        const farCount = 5;
        const points = edgeSpawnPoints(quad, farCount, spawner.far.edgeInset);
        expect(points).toHaveLength(farCount);

        for (const point of points) {
            const placed = outside(point);
            for (const zone of spawner.exclude ?? []) {
                expect(
                    inZone(placed.x, placed.y, zone),
                    `(${point.x},${point.y}) escaped to (${placed.x},${placed.y}) — still banned`,
                ).toBe(false);
            }
        }
    });

    it('pushes the sky points onto the floor', () => {
        const spawner = level.spawner!;
        const quad = {
            x: level.imageSize.width / 2,
            y: 0,
            width: level.imageSize.width / 2,
            height: level.imageSize.height / 2,
        };
        const points = edgeSpawnPoints(quad, 5, spawner.far.edgeInset);
        // Baseline (before the ban) these sat in the starry void above the torn floor edge.
        const sky = points.filter((p) => p.y <= spawner.far.edgeInset + 1);
        expect(sky.length).toBeGreaterThan(0);
        for (const point of sky) {
            const placed = outside(point);
            // Displaced at all: either dropped to the floor band (y grows) or slid left along
            // the top edge, out of the void.
            expect(placed.x !== point.x || placed.y !== point.y, `${point.x},${point.y}`).toBe(
                true,
            );
        }
    });
});
