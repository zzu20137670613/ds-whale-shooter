/**
 * tests/lib/levels/atlantis-clear.test.ts
 * --------------------------------------------------------------------------
 * Atlantis is a one-way chain of four levels ending at a throne.
 *
 * The owner: `入口右中连遗落之船左中，遗落之船右下连废弃宫殿下中，废弃宫殿上中连加冕台`.
 * Each of those is a teleporter pair, and the chain only runs forward in his drawing; the
 * throne at the end is not a portal at all, it is an invisible travel trigger into the boss
 * walk. That combination is what this file pins down.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels/types';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');
const load = (id: string): Level =>
    parseLevelYaml(readFileSync(join(LEVELS, `${id}.yaml`), 'utf8'), id);

const CHAIN = [
    'dsh-atlantis-1-entrance',
    'dsh-atlantis-2-sunken-ship',
    'dsh-atlantis-3-ruined-palace',
    'dsh-atlantis-4-coronation-dais',
] as const;

describe('the four waves', () => {
    it('are 1/2/2/3, one plan per level', () => {
        const waves = CHAIN.map((id) => load(id).spawner?.waves);
        expect(waves).toEqual([1, 2, 2, 3]);
    });

    it('spawn the Atlantean pool, not the library one', () => {
        for (const id of CHAIN) {
            expect(load(id).spawner?.pool.melee, id).toEqual(['warden']);
            expect(load(id).spawner?.pool.ranged, id).toEqual(['bengbu-erba']);
        }
    });
});

describe('the chain runs forward', () => {
    it('each level hands to the next', () => {
        for (let i = 0; i < CHAIN.length - 1; i += 1) {
            const here = load(CHAIN[i]);
            const forwards = (here.teleporters ?? []).filter(
                (portal) => portal.targetScene === CHAIN[i + 1],
            );
            expect(forwards.length, `${CHAIN[i]} -> ${CHAIN[i + 1]}`).toBeGreaterThan(0);
        }
    });

    it('the last level ends at the throne, not a portal', () => {
        const dais = load('dsh-atlantis-4-coronation-dais');
        const throne = (dais.triggers ?? []).find((trigger) => 'travel' in trigger);
        expect(throne).toBeDefined();
        if (throne && 'travel' in throne) {
            expect(throne.travel.targetScene).toBe('warhammer-redeem-1-chapel');
            // The door only opens once the level is clean, and Claude cannot spend it.
            expect(throne.travel.requiresClear).toBe(true);
            // 主人 2026-11-12：Claude 踩王座也要能进 boss 关。
        expect(throne.travel.excludeCharacters).toEqual([]);
        }
    });
});

describe('the way in from sky city', () => {
    it('still exists on the throne hall', () => {
        const sky = load('gpt-sky-city-4-throne-hall');
        const into = (sky.teleporters ?? []).find(
            (portal) => portal.targetScene === 'dsh-atlantis-1-entrance',
        );
        expect(into).toBeDefined();
        expect(into!.targetPortalId).toBe('from-sky-city');
    });

    it('is answered by the entrance portal', () => {
        const atl = load('dsh-atlantis-1-entrance');
        const back = (atl.teleporters ?? []).find((portal) => portal.id === 'from-sky-city');
        expect(back).toBeDefined();
        expect(back!.targetScene).toBe('gpt-sky-city-4-throne-hall');
    });
});
