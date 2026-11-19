/**
 * tests/lib/bosses/arena-spawn.test.ts
 * --------------------------------------------------------------------------
 * Where Claude stands in each of the four boss levels.
 *
 * The boss walk used to be ONE 11008x6144 plate with four `arenaSpawn` points - one per
 * painted block, which is one per phase. The owner's plan now has one level per block
 * (`四阶段正好对应四个地图`), so the same four points live one-per-file, in that file's own
 * local coordinates.
 *
 * World -> local is the block origin: the two western blocks keep their x, the two eastern
 * ones lose 5504; the two southern ones lose 3072 from y. That arithmetic is asserted here,
 * because getting one wrong puts Claude in the next room.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels/types';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');

interface BossLevel {
    id: string;
    /** The point this level declares, in its own local pixels. */
    spot: { x: number; y: number };
    /** Where the same point sat on the old 11008x6144 plate. */
    world: { x: number; y: number };
    level: Level;
}

const load = (id: string, world: { x: number; y: number }): BossLevel => {
    const level = parseLevelYaml(readFileSync(join(LEVELS, `${id}.yaml`), 'utf8'), id);
    const spawns = level.arenaSpawn ?? [];
    expect(spawns, `${id} must declare exactly one arenaSpawn`).toHaveLength(1);
    return { id, spot: spawns[0], world, level };
};

/** Phase 1..4, in the order the owner walks them. */
const BOSS: BossLevel[] = [
    load('warhammer-redeem-1-chapel', { x: 2752, y: 1536 }),
    load('warhammer-redeem-2-warship', { x: 7572, y: 1892 }),
    load('warhammer-redeem-3-fireworks', { x: 7572, y: 4580 }),
    load('warhammer-redeem-4-first-meeting', { x: 2564, y: 4768 }),
];

/** The block origin each level was cut from. */
const ORIGIN: Record<string, { x: number; y: number }> = {
    'warhammer-redeem-1-chapel': { x: 0, y: 0 },
    'warhammer-redeem-2-warship': { x: 5504, y: 0 },
    'warhammer-redeem-3-fireworks': { x: 5504, y: 3072 },
    'warhammer-redeem-4-first-meeting': { x: 0, y: 3072 },
};

/** Is (x, y) inside any of this level's wall polygons? */
function inWall(level: Level, x: number, y: number): boolean {
    for (const wall of level.airWalls) {
        const pts = wall.points;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[j];
            if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) {
                inside = !inside;
            }
        }
        if (inside) return true;
    }
    return false;
}

describe('the authored spawn points', () => {
    it('are four, one per boss level', () => {
        expect(BOSS).toHaveLength(4);
    });

    it('match the marks on the old plate once the block origin is added back', () => {
        for (const entry of BOSS) {
            const origin = ORIGIN[entry.id];
            expect(
                { x: entry.spot.x + origin.x, y: entry.spot.y + origin.y },
                entry.id,
            ).toEqual(entry.world);
        }
    });

    it('sit inside their own level', () => {
        for (const { id, spot, level } of BOSS) {
            expect(spot.x, id).toBeGreaterThan(0);
            expect(spot.x, id).toBeLessThan(level.imageSize.width);
            expect(spot.y, id).toBeGreaterThan(0);
            expect(spot.y, id).toBeLessThan(level.imageSize.height);
        }
    });

    it('are all on floor - she cannot spawn inside a wall', () => {
        for (const { id, spot, level } of BOSS) {
            expect(inWall(level, spot.x, spot.y), `${id} @ ${spot.x},${spot.y}`).toBe(false);
        }
    });
});