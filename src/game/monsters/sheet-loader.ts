/**
 * src/game/monsters/sheet-loader.ts
 * --------------------------------------------------------------------------
 * Queueing monster sheets on Phaser's loader — and nothing else.
 *
 * Kept out of `monster.ts` so it can be unit-tested without pulling Phaser into the test
 * environment, and so the one rule that matters here has a home: **queue synchronously**.
 *
 * The rule exists because of a phone-only bug: the sheets used to be queued only after an
 * `<img>` decode of the same PNG resolved, and a file added after Phaser's loader finished is
 * never fetched. The 2048² guardians decoded slowly enough on a phone to lose that race, so
 * Kitty spawned with a name plate, an HP bar, a weapon and no body — a sprite is only created
 * when its texture exists (`图书馆boss的立绘不显示了，只显示个武器`, owner, 2026-11-14).
 *
 * Cell sizes are measured before the scene starts (`resolveScene` → `monsterCells`), the same
 * way the player's `spriteCell` always was.
 */

import type { MonsterSpec } from '@/lib/monsters/types';

/** Texture key for a monster sheet. Namespaced: `background` alone collides in the cache. */
export function textureKey(spec: MonsterSpec): string {
    return `monster:${spec.id ?? spec.name}`;
}

/**
 * Queue every monster sheet on the loader. Synchronous on purpose — see the file header.
 *
 * A spec with no sprite, or one whose cell was never measured, is skipped: a 0×0 frame grid
 * loads a texture that cannot be sliced, which reads exactly like missing art.
 */
export function loadMonsterAssets(
    scene: Pick<Phaser.Scene, 'load'>,
    specs: Iterable<MonsterSpec>,
    cells: ReadonlyMap<string, { width: number; height: number }>,
): void {
    for (const spec of specs) {
        if (!spec.sprite) continue;
        const cell = cells.get(spec.id ?? spec.name);
        if (!cell || cell.width <= 0 || cell.height <= 0) continue;
        const url = spec.sprite.texture.startsWith('/')
            ? spec.sprite.texture
            : `/${spec.sprite.texture}`;
        scene.load.spritesheet(textureKey(spec), url, {
            frameWidth: cell.width,
            frameHeight: cell.height,
        });
    }
}
