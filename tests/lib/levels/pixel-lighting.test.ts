/**
 * tests/lib/levels/pixel-lighting.test.ts
 * --------------------------------------------------------------------------
 * The painted worlds do not run the pixel-light filter.
 *
 * The owner: `月桥色调明显偏暗了，检查一下是不是又出现了以前的图层问题？`. It was: the split
 * levels were generated without a `pixelLighting` key, and the scene falls back to
 * `PIXEL_LIGHTING_CONFIG.ENABLE` when the key is missing - so the twelve new levels all
 * came out under the darkening tint while the 4x4 plates they were cut from carried
 * `pixelLighting: false`.
 *
 * Measured afterwards: the moon bridge frame averages 188 on a 0-255 scale against 195 for
 * its own art, i.e. the tint is gone.
 *
 * This test is the guard: every painted 2x2 level must say so explicitly instead of
 * inheriting a global default.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEVEL_TILE_SIZE } from '@/lib/constants';
import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels/types';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');

const all: { id: string; level: Level }[] = readdirSync(LEVELS)
    .filter((name) => name.endsWith('.yaml') && name !== 'index.yaml')
    .map((name) => {
        const id = name.replace(/\.yaml$/, '');
        return { id, level: parseLevelYaml(readFileSync(join(LEVELS, name), 'utf8'), id) };
    });

/** The twelve levels cut from the three 4x4 plates. */
const PAINTED_SPLIT = all.filter(({ id }) =>
    /^(gpt-sky-city|dsh-atlantis|warhammer-redeem)-\d-/.test(id),
);

describe('the split painted levels', () => {
    it('are all present', () => {
        expect(PAINTED_SPLIT).toHaveLength(12);
    });

    it('all cover a single tile', () => {
        for (const { id, level } of PAINTED_SPLIT) {
            expect(level.imageSize, id).toEqual({
                width: LEVEL_TILE_SIZE.width * 2,
                height: LEVEL_TILE_SIZE.height * 2,
            });
        }
    });

    it('each declare pixelLighting: false instead of inheriting it', () => {
        for (const { id, level } of PAINTED_SPLIT) {
            expect(level.pixelLighting, id).toBe(false);
        }
    });
});