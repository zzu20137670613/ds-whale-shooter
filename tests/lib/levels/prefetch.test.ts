import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { collectDropIds } from '@/lib/levels/prefetch';
import { parseLevelYaml } from '@/lib/levels/parser';
import type { Level } from '@/lib/levels';
import type { MonsterSpec } from '@/lib/monsters';

function level(partial: Partial<Level> = {}): Level {
    return {
        title: 't',
        background: 'a.png',
        imageSize: { width: 1, height: 1 },
        airWalls: [],
        ...partial,
    };
}

describe('collectDropIds', () => {
    it('returns only static dropSpawns when no monsters', () => {
        const ids = collectDropIds(
            level({ dropSpawns: [{ type: 'hp-shard', x: 1, y: 2 }] }),
            new Map(),
        );
        expect(ids).toEqual(new Set(['hp-shard']));
    });

    it('collects monster death drops from every spec referenced', () => {
        const monsters = new Map<string, MonsterSpec>([
            [
                'drone',
                {
                    id: 'drone',
                    name: 'Drone',
                    hp: 30,
                    money: 16,
                    moveSpeed: 4,
                    body: { halfW: 14, halfH: 14 },
                    weaponId: 'drone-claws',
                    drops: [{ dropId: 'hp-shard', chance: 0.4 }],
                },
            ],
            [
                'gunner',
                {
                    id: 'gunner',
                    name: 'Gunner',
                    hp: 20,
                    money: 12,
                    moveSpeed: 3,
                    body: { halfW: 14, halfH: 14 },
                    weaponId: 'gunner-blast',
                    drops: [{ dropId: 'ammo-cache', chance: 0.5 }],
                },
            ],
        ]);
        const ids = collectDropIds(level(), monsters);
        expect(ids).toEqual(new Set(['hp-shard', 'ammo-cache']));
    });

    it('unions static + monster drops without duplicates', () => {
        const monsters = new Map<string, MonsterSpec>([
            [
                'drone',
                {
                    id: 'drone',
                    name: 'Drone',
                    hp: 30,
                    money: 16,
                    moveSpeed: 4,
                    body: { halfW: 14, halfH: 14 },
                    weaponId: 'drone-claws',
                    drops: [{ dropId: 'hp-shard', chance: 1 }],
                },
            ],
        ]);
        const ids = collectDropIds(
            level({ dropSpawns: [{ type: 'hp-shard', x: 0, y: 0 }] }),
            monsters,
        );
        expect(ids).toEqual(new Set(['hp-shard']));
    });

    it('returns empty set when neither field is set', () => {
        const ids = collectDropIds(level(), new Map());
        expect(ids.size).toBe(0);
    });

    it('collects the reward of a region trigger (regression: the egg froze the game)', () => {
        // A trigger spawns its reward at fire time, so nothing else in the
        // level names the drop. Missing it here meant `iced-juice` was never
        // loaded and the beach egg died on an uncaught "Unknown drop id".
        const ids = collectDropIds(
            level({
                triggers: [
                    {
                        id: 'lounger-juice',
                        zone: { x: 0, y: 0, width: 10, height: 10 },
                        spawn: {
                            type: 'iced-juice',
                            from: { x: 0, y: 0 },
                            to: { x: 1, y: 1 },
                            lift: 90,
                            durationMs: 700,
                        },
                    },
                ],
            }),
            new Map(),
        );
        expect(ids).toEqual(new Set(['iced-juice']));
    });
    it('ignores monsters whose spec has no drops', () => {
        const monsters = new Map<string, MonsterSpec>([
            [
                'empty',
                {
                    id: 'empty',
                    name: 'Empty',
                    hp: 10,
                    money: 0,
                    moveSpeed: 1,
                    body: { halfW: 14, halfH: 14 },
                    weaponId: 'claw',
                    drops: [],
                },
            ],
        ]);
        const ids = collectDropIds(level(), monsters);
        expect(ids.size).toBe(0);
    });
});

describe('the shipped beach level', () => {
    it('prefetches the lounger egg reward so fire time can resolve it', () => {
        // Regression: `iced-juice` is named only by the trigger, so nothing
        // loaded it and the egg died on an uncaught "Unknown drop id" in the
        // middle of a game. Fixtures cannot catch that; the real YAML can.
        const beach = parseLevelYaml(
            readFileSync(
                join(process.cwd(), 'public', 'data', 'levels', 'beach-holiday.yaml'),
                'utf8',
            ),
            'beach-holiday',
        );
        const first = beach.triggers?.[0];
        const reward = first && 'spawn' in first ? first.spawn.type : undefined;
        expect(reward).toBe('iced-juice');
        expect(collectDropIds(beach, new Map())).toContain(reward);
    });
});
