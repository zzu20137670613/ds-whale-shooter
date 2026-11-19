/**
 * tests/lib/levels/wave-tune.test.ts
 * --------------------------------------------------------------------------
 * Wave counts per painted level.
 *
 * Every painted world was unbundled from one 11008x6144 plate into four 5504x3072 levels,
 * and the owner kept one rule for all of them: `沿用图书馆 1/2/2/3`. A level's spawner
 * halves its own world again, so a single-tile level still has the four quadrants `waves`
 * counts - the split needed nothing but the number.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';

const ROOT = process.cwd();
const load = (id: string) =>
    parseLevelYaml(readFileSync(join(ROOT, 'public', 'data', 'levels', `${id}.yaml`), 'utf8'), id);

/** Map slug -> its four level ids, in play order. */
const MAPS: Readonly<Record<string, readonly string[]>> = {
    'starry-library': [
        'starry-library-1-entrance',
        'starry-library-2-counter',
        'starry-library-3-terrace',
        'starry-library-4-scroll',
    ],
    'gpt-sky-city-4-throne-hall': [
        'gpt-sky-city-1-entrance',
        'gpt-sky-city-2-moon-bridge',
        'gpt-sky-city-3-great-tome',
        'gpt-sky-city-4-throne-hall',
    ],
    'dsh-atlantis-4-coronation-dais': [
        'dsh-atlantis-1-entrance',
        'dsh-atlantis-2-sunken-ship',
        'dsh-atlantis-3-ruined-palace',
        'dsh-atlantis-4-coronation-dais',
    ],
};

/** 1 / 2 / 2 / 3 - the owner's shape for every painted world. */
const WAVES = [1, 2, 2, 3] as const;

describe('every painted world', () => {
    for (const [map, ids] of Object.entries(MAPS)) {
        it(`${map} runs 1/2/2/3`, () => {
            ids.forEach((id, index) => {
                expect(load(id).spawner?.waves, `${map} / ${id}`).toBe(WAVES[index]);
            });
        });

        it(`${map} covers single tiles, not the old plate`, () => {
            for (const id of ids) {
                expect(load(id).imageSize).toEqual({ width: 5504, height: 3072 });
                expect(load(id).backgroundBlocks).toBeUndefined();
            }
        });

        it(`${map} keeps the shared wave shape`, () => {
            for (const id of ids) {
                const spawner = load(id).spawner!;
                expect(spawner.near.count, id).toBe(4);
                expect(spawner.far.count, id).toBe(5);
                expect(spawner.pool.melee.length, id).toBeGreaterThan(0);
                expect(spawner.pool.ranged.length, id).toBeGreaterThan(0);
            }
        });
    }

    it('the boss walk has no trash spawner at all', () => {
        // The old 11008x6144 boss plate carried exactly one monster - Claude. The four boss
        // levels keep that: no region spawner, the fight is her alone.
        for (const id of [
            'warhammer-redeem-1-chapel',
            'warhammer-redeem-2-warship',
            'warhammer-redeem-3-fireworks',
            'warhammer-redeem-4-first-meeting',
        ]) {
            expect(load(id).spawner, id).toBeUndefined();
        }
    });

    it('defaults to 1 on a map that does not ask', () => {
        const beach = parseLevelYaml(
            readFileSync(join(ROOT, 'public', 'data', 'levels', 'beach-holiday.yaml'), 'utf8'),
            'beach-holiday',
        );
        expect(beach.spawner?.meleeHpMultiplier ?? 1).toBe(1);
    });
});
