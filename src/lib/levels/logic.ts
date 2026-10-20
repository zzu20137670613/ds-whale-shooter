/**
 * src/lib/levels/logic.ts
 * --------------------------------------------------------------------------
 * Pure level decisions shared by the scene glue and the data tests.
 */

import type { Level, Teleporter } from './types';

/**
 * Is a teleporter usable yet?
 *
 * A portal stays dark until the level's monsters are cleared, unless it opts
 * out with `requiresClear: false` — the tavern exit, which must never be
 * gated. The tavern used to be exempt as a whole scene, which made it
 * impossible to gate anything inside it; the hidden level 1 entrance needs
 * exactly that (the tavern's only monster is the wall ornament), so the
 * decision now lives per portal.
 */
export function isPortalArmed(
    spec: Pick<Teleporter, 'requiresClear'>,
    monstersCleared: boolean,
): boolean {
    return spec.requiresClear === false || monstersCleared;
}

/** One image of the ground, positioned in level coordinates. */
export interface GroundLayer {
    /** Phaser texture key — namespaced per level, see LoadScene.preload. */
    key: string;
    /** Path under public/ to fetch. */
    path: string;
    x: number;
    y: number;
}

/**
 * The ground images a level draws, in draw order.
 *
 * A level whose world is wider than the art it was painted at lists one block
 * per painted tile in `backgroundBlocks`; every texture upload then stays at
 * the block size while `imageSize` still describes the whole world, so the
 * camera, the world bounds and the walls all see one big level.
 */
export function groundLayers(
    levelId: string,
    level: Pick<Level, 'background' | 'backgroundBlocks'>,
): GroundLayer[] {
    const blocks = level.backgroundBlocks;
    if (blocks && blocks.length > 0) {
        return blocks.map((block, index) => ({
            key: `background:${levelId}:${index}`,
            path: block.texture,
            x: block.x,
            y: block.y,
        }));
    }
    return [{ key: `background:${levelId}`, path: level.background, x: 0, y: 0 }];
}

/** Key a prop is remembered by: the level it stands in plus its type. */
export function propKey(levelId: string, type: string): string {
    return `${levelId}:${type}`;
}

/**
 * Drop the prop spawns the player has already shot open.
 *
 * A prop is scenery rather than a creature, so opening one is world state and
 * not run state: the tavern ornament that hides the hidden level 1 entrance
 * must not grow back every time the player walks in. Only prop keys are ever
 * recorded (the scene records one when a monster with `prop: true` dies), so a
 * spawn whose type matches a recorded key is that prop.
 */
export function spawnsWithoutBrokenProps<T extends { type: string }>(
    levelId: string,
    spawns: readonly T[] | undefined,
    brokenProps: readonly string[],
): T[] | undefined {
    if (!spawns) return spawns;
    return spawns.filter((spawn) => !brokenProps.includes(propKey(levelId, spawn.type)));
}
