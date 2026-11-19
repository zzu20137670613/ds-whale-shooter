/**
 * tests/lib/levels/portal-radius.test.ts
 * --------------------------------------------------------------------------
 * One portal size per map class.
 *
 * The owner:
 *   2x2 levels:      `包括海滩假日和所有2*2的图，以后只要是2*2的图把传送阵半径都设置为200`
 *   4x4 and bigger:  `4*4以上的图（包括4*4）半径都设置300`
 *
 * Every painted world has since been unbundled, so today nothing is 4x4 - the big-map rule
 * stays in the codebase (and in this file) for whatever gets built next at that size.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    LEVEL_TILE_SIZE,
    TELEPORTER_RADIUS_2X2_PX,
    TELEPORTER_RADIUS_4X4_PX,
} from '@/lib/constants';
import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels/types';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');

const allLevels: { id: string; level: Level }[] = readdirSync(LEVELS)
    .filter((name) => name.endsWith('.yaml') && name !== 'index.yaml')
    .map((name) => {
        const id = name.replace(/\.yaml$/, '');
        return { id, level: parseLevelYaml(readFileSync(join(LEVELS, name), 'utf8'), id) };
    });

const tilesOf = (level: Level): { wide: number; tall: number } => ({
    wide: level.imageSize.width / LEVEL_TILE_SIZE.width,
    tall: level.imageSize.height / LEVEL_TILE_SIZE.height,
});

const twoByTwo = allLevels.filter(({ level }) => {
    const { wide, tall } = tilesOf(level);
    return wide === 2 && tall === 2;
});

const fourByFourAndUp = allLevels.filter(({ level }) => {
    const { wide, tall } = tilesOf(level);
    return wide >= 4 && tall >= 4;
});

describe('portal radius on 2x2 levels', () => {
    it('found the painted worlds', () => {
        const ids = twoByTwo.map((entry) => entry.id);
        expect(ids).toContain('beach-holiday');
        expect(ids).toContain('starry-library-4-scroll');
        expect(ids).toContain('gpt-sky-city-4-throne-hall');
        expect(ids).toContain('warhammer-redeem-4-first-meeting');
    });

    it('sets exactly 200 on every portal', () => {
        for (const { id, level } of twoByTwo) {
            for (const portal of level.teleporters ?? []) {
                expect(portal.radius, `${id} / ${portal.id ?? 'portal'}`).toBe(
                    TELEPORTER_RADIUS_2X2_PX,
                );
            }
        }
    });
});

describe('portal radius on 4x4-and-bigger levels', () => {
    it('sets exactly 300 on every portal', () => {
        // The boss walk is still one 4x4 plate while its split is in flight, so this class
        // is not empty yet - every portal on it must already carry the owner's 300.
        for (const { id, level } of fourByFourAndUp) {
            for (const portal of level.teleporters ?? []) {
                expect(portal.radius, `${id} / ${portal.id ?? 'portal'}`).toBe(
                    TELEPORTER_RADIUS_4X4_PX,
                );
            }
        }
        expect(TELEPORTER_RADIUS_2X2_PX).not.toBe(TELEPORTER_RADIUS_4X4_PX);
    });
});

describe('the small rooms', () => {
    it('keeps their hand-tuned radii, outside both rules', () => {
        const tavern = allLevels.find((entry) => entry.id === 'tavern');
        const radii = (tavern?.level.teleporters ?? []).map((portal) => portal.radius);
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.some((radius) => radius !== TELEPORTER_RADIUS_2X2_PX)).toBe(true);
    });
});
