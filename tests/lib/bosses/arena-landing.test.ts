/**
 * tests/lib/bosses/arena-landing.test.ts
 * --------------------------------------------------------------------------
 * Every boss level must be landable: the walls have to leave open floor where the player
 * walks in and where Claude stands.
 *
 * The old failure this file was born from - a landing point sitting inside a seam wall
 * (`从星海地图直接通往小巷好像不通`) - cannot happen between blocks any more, because each
 * block is now its own level and each level's walls come from the owner's own painting. The
 * risk that remains is exactly the same one though: a wall edit that swallows the entry
 * point or the arena point. So the check is kept, per level.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels/types';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');

const BOSS_IDS = [
    'warhammer-redeem-1-chapel',
    'warhammer-redeem-2-warship',
    'warhammer-redeem-3-fireworks',
    'warhammer-redeem-4-first-meeting',
] as const;

const levels: { id: string; level: Level }[] = BOSS_IDS.map((id) => ({
    id,
    level: parseLevelYaml(readFileSync(join(LEVELS, `${id}.yaml`), 'utf8'), id),
}));

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

describe('the walls themselves', () => {
    it('every boss level parses a real wall set', () => {
        // A single-tile level keeps the painted obstructions of its own block: the ruins
        // pillars, the warship's hull lines, the alley's stalls, the courtyard's rim.
        for (const { id, level } of levels) {
            expect(level.airWalls.length, id).toBeGreaterThan(5);
        }
    });

    it('keeps every wall inside its own level', () => {
        for (const { id, level } of levels) {
            for (const wall of level.airWalls) {
                for (const [x, y] of wall.points) {
                    expect(x, id).toBeGreaterThanOrEqual(0);
                    expect(x, id).toBeLessThanOrEqual(level.imageSize.width);
                    expect(y, id).toBeGreaterThanOrEqual(0);
                    expect(y, id).toBeLessThanOrEqual(level.imageSize.height);
                }
            }
        }
    });
});

describe('the landing points', () => {
    it('leave the player spawn on floor', () => {
        for (const { id, level } of levels) {
            const spawn = level.characterSpawn!;
            expect(inWall(level, spawn.x, spawn.y), `${id} spawn`).toBe(false);
        }
    });

    it('leave the arena point on floor', () => {
        for (const { id, level } of levels) {
            const spot = level.arenaSpawn![0];
            expect(inWall(level, spot.x, spot.y), `${id} arena`).toBe(false);
        }
    });
});