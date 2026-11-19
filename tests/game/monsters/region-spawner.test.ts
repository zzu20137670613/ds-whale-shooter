/**
 * tests/game/monsters/region-spawner.test.ts
 * --------------------------------------------------------------------------
 * The follow-spawn must actually spawn, and it must not eat its own waves.
 *
 * The owner, twice: `进入图书馆、天空城之后还是没有刷怪，直接出神秘商人和传送阵了`.
 *
 * Two separate causes, both here:
 *
 *   1. `remember(index)` ran when the wave was QUEUED, not when it fired. Any run that walked
 *      into a quadrant and left before the 2s delay marked the quadrant as done and lost the
 *      wave - permanently.
 *   2. `wavesFired` seeded itself from the count of remembered quadrants, so a save carrying
 *      three "done" keys started every level already finished: no monsters, and `isDone()`
 *      true means the exit portal and the merchant open on an untouched map.
 *
 * The persisted keys are versioned now, which retires the poisoned entries in existing saves.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { RegionSpawner } from '@/game/monsters/region-spawner';
import { useGameStore } from '@/store/game-store';
import type { MonsterSpec } from '@/lib/monsters';
import type { WeaponSpec } from '@/lib/weapons';
import type { RegionSpawnerConfig } from '@/game/monsters/region-spawner';

const LEVEL = 'starry-library';
const SIZE = { width: 11008, height: 6144 };

const CONFIG: RegionSpawnerConfig = {
    delayMs: 2000,
    waves: 3,
    near: { count: 2, minDistance: 300, maxDistance: 900 },
    far: { count: 2, edgeInset: 200 },
    pool: { melee: ['drone'], ranged: ['sniper'] },
} as RegionSpawnerConfig;

const MONSTER = (id: string) => ({ id, weaponId: `w-${id}` }) as unknown as MonsterSpec;
const WEAPON = { id: 'w' } as unknown as WeaponSpec;

function makeSpawner(clock: { now: number }, overrides: Partial<RegionSpawnerConfig> = {}) {
    const spawned: { x: number; y: number; waveId: string }[] = [];
    const spawner = new RegionSpawner({
        levelId: LEVEL,
        imageSize: SIZE,
        config: { ...CONFIG, ...overrides },
        getMonster: (type) => MONSTER(type),
        getWeapon: () => WEAPON,
        spawn: (_spec, _weapon, x, y, waveId) => spawned.push({ x, y, waveId }),
        isBlocked: () => false,
        now: () => clock.now,
        rng: () => 0.5,
    });
    return { spawner, spawned };
}

beforeEach(() => {
    useGameStore.setState({ spawnedRegions: [] });
});

describe('a wave that was queued but never fired', () => {
    it('fires once the delay has passed', () => {
        const clock = { now: 1000 };
        const { spawner, spawned } = makeSpawner(clock);

        spawner.update(1000, 1000);
        expect(spawned).toHaveLength(0);

        clock.now += 2500;
        spawner.update(1000, 1000);
        // Composition is fixed by the design: 4 near + 5 far, nine per wave.
        expect(spawned).toHaveLength(9);
    });

    it('counts a fired wave exactly once across frames', () => {
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock);

        spawner.update(1000, 1000);
        clock.now += 2500;
        spawner.update(1000, 1000);
        const first = spawned.length;
        spawner.update(1000, 1000);
        expect(spawned.length).toBe(first);
        expect(spawner.firedWaves).toBe(1);
    });
});

describe('stale save data', () => {
    it('ignores unversioned keys, so a poisoned save still spawns', () => {
        // Exactly what the owner's save holds: three quadrants "done" from the broken build.
        useGameStore.setState({
            spawnedRegions: [`${LEVEL}:0`, `${LEVEL}:1`, `${LEVEL}:2`],
        });
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock);

        expect(spawner.firedWaves).toBe(0);
        expect(spawner.isDone()).toBe(false);

        spawner.update(1000, 1000);
        clock.now += 2500;
        spawner.update(1000, 1000);
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('re-farms the same level on a fresh visit, whatever the save says', () => {
        // `每次进入都刷怪`: the spawner keeps no memory across visits, so the very keys a
        // previous visit wrote must not shorten this one.
        useGameStore.setState({
            spawnedRegions: [
                `v2:${LEVEL}:0`,
                `v2:${LEVEL}:1`,
                `v2:${LEVEL}:2`,
                `v2:${LEVEL}:3`,
            ],
        });
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock);

        expect(spawner.firedWaves).toBe(0);
        expect(spawner.isDone()).toBe(false);

        spawner.update(1000, 1000);
        clock.now += 2500;
        spawner.update(1000, 1000);
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('ignores keys that belong to another level', () => {
        useGameStore.setState({ spawnedRegions: ['v2:gpt-sky-city-4-throne-hall:0', 'v2:gpt-sky-city-4-throne-hall:1'] });
        const { spawner } = makeSpawner({ now: 0 });
        expect(spawner.firedWaves).toBe(0);
    });
});

describe('isDone', () => {
    it('is false until every configured wave has fired', () => {
        const clock = { now: 0 };
        const { spawner } = makeSpawner(clock);

        expect(spawner.isDone()).toBe(false);

        // One fresh quadrant per wave: the map splits at half width / half height.
        const quadrants: [number, number][] = [
            [100, 100],
            [6000, 100],
            [100, 4000],
        ];
        for (const [x, y] of quadrants) {
            clock.now += 10000;
            spawner.update(x, y);
            clock.now += 2500;
            spawner.update(x, y);
        }

        expect(spawner.firedWaves).toBe(CONFIG.waves);
        expect(spawner.isDone()).toBe(true);
    });
});

describe('no-spawn rectangles', () => {
    // The owner: `天空之城刷怪右上角地图的上方这里要避开，有一只怪刷墙里去了`. The pavilion roof is
    // walkable as far as the collision grid knows, so the wall check never fired there.
    const ROOF = { x: 5504, y: 0, width: 5504, height: 1440 };

    it('never places a monster inside the roof band', () => {
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock, { exclude: [ROOF] });

        // Walk all four quadrants so every far edge gets used.
        for (const [x, y] of [
            [1000, 1000],
            [9000, 1000],
            [1000, 5000],
            [9000, 5000],
        ]) {
            spawner.update(x, y);
            clock.now += 2500;
            spawner.update(x, y);
            clock.now += 2500;
            spawner.update(x, y);
        }

        expect(spawned.length).toBeGreaterThan(0);
        const inside = spawned.filter(
            (p) =>
                p.x >= ROOF.x &&
                p.x <= ROOF.x + ROOF.width &&
                p.y >= ROOF.y &&
                p.y <= ROOF.y + ROOF.height,
        );
        expect(inside).toEqual([]);
    });

    it('pushes the point just below the band rather than teleporting it across the map', () => {
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock, { exclude: [ROOF] });
        // Player in the NE quadrant pulls that quadrant's far edge into the roof.
        spawner.update(9000, 1000);
        clock.now += 2500;
        spawner.update(9000, 1000);

        const below = spawned.filter((p) => p.y > ROOF.height && p.y < ROOF.height + 400);
        expect(below.length).toBeGreaterThan(0);
    });

    it('is a no-op when the level declares no rectangles', () => {
        const clock = { now: 0 };
        const { spawner, spawned } = makeSpawner(clock);
        spawner.update(1000, 1000);
        clock.now += 2500;
        spawner.update(1000, 1000);
        expect(spawned).toHaveLength(9);
    });
});
