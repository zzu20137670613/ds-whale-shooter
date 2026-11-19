/**
 * tests/game/monsters/load-monster-assets.test.ts
 * --------------------------------------------------------------------------
 * 手机实测：图书馆的 Kitty 只画出武器，身体不见了（`图书馆boss的立绘不显示了，只显示个武器`）。
 *
 * The body sprite is only created when `scene.textures.exists(key)` is true, so a sheet that
 * never finishes loading is a monster with a name plate, an HP bar, a weapon — and no body.
 *
 * The sheet used to be queued from inside `preload()` after awaiting an `<img>` decode of the
 * same PNG. On a phone that decode takes long enough for the 2048² guardian sheets to land
 * after Phaser's loader has already finished, and a file added to a finished loader is never
 * fetched. Small 512² monsters won that race; the guardians lost it.
 *
 * So the rule this file pins: `loadMonsterAssets` must queue everything **synchronously**, from
 * cell sizes that were measured before the scene started (the same way characters already do it).
 */

import { describe, expect, it } from 'vitest';

import { loadMonsterAssets } from '@/game/monsters/sheet-loader';
import type { MonsterSpec } from '@/lib/monsters/types';

interface Queued {
    key: string;
    url: string;
    frameWidth: number;
    frameHeight: number;
}

function fakeScene(queue: Queued[]) {
    return {
        load: {
            spritesheet(
                key: string,
                url: string,
                config: { frameWidth: number; frameHeight: number },
            ) {
                queue.push({ key, url, ...config });
            },
        },
    } as unknown as Parameters<typeof loadMonsterAssets>[0];
}

function spec(id: string, texture: string): MonsterSpec {
    return {
        id,
        name: id,
        nameZh: id,
        hp: 10,
        moveSpeed: 1,
        money: 0,
        armor: 0,
        body: { halfW: 8, halfH: 8 },
        weaponId: 'gun',
        sprite: { texture, grid: { rows: 4, cols: 4 }, scale: 0.5 },
        anims: {},
    } as unknown as MonsterSpec;
}

describe('loadMonsterAssets', () => {
    it('queues every sheet before it returns, with no await in between', () => {
        const queue: Queued[] = [];
        const cells = new Map([
            ['kitty', { width: 512, height: 512 }],
            ['keeper', { width: 128, height: 128 }],
        ]);

        loadMonsterAssets(
            fakeScene(queue),
            [
                spec('kitty', 'assets/image/monsters/kitty.png'),
                spec('keeper', 'assets/image/monsters/keeper.png'),
            ],
            cells,
        );

        // No `await` above on purpose: if this function goes async again, these two
        // assertions fail, which is the regression this file exists to catch.
        expect(queue).toHaveLength(2);
        expect(queue.map((q) => q.key)).toEqual(['monster:kitty', 'monster:keeper']);
        expect(queue[0]).toMatchObject({ frameWidth: 512, frameHeight: 512 });
    });

    it('leads the URL with a slash, so a nested route still resolves it', () => {
        const queue: Queued[] = [];
        loadMonsterAssets(
            fakeScene(queue),
            [spec('kitty', 'assets/image/monsters/kitty.png')],
            new Map([['kitty', { width: 512, height: 512 }]]),
        );
        expect(queue[0]?.url).toBe('/assets/image/monsters/kitty.png');
    });

    it('keeps an absolute URL as it is', () => {
        const queue: Queued[] = [];
        loadMonsterAssets(
            fakeScene(queue),
            [spec('kitty', '/already/absolute.png')],
            new Map([['kitty', { width: 512, height: 512 }]]),
        );
        expect(queue[0]?.url).toBe('/already/absolute.png');
    });

    it('skips a spec with no sprite, and one with no measured cell', () => {
        const queue: Queued[] = [];
        const noSprite = { ...spec('drone', 'x.png'), sprite: undefined } as unknown as MonsterSpec;
        loadMonsterAssets(fakeScene(queue), [noSprite, spec('unmeasured', 'y.png')], new Map());
        expect(queue).toHaveLength(0);
    });
});
