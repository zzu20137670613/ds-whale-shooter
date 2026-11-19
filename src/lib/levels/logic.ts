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

/**
 * The size each ground image must be drawn at, given the texture the browser actually decoded.
 *
 * The world (`imageSize`, every wall, every spawn) is authored against the painting's own pixel
 * size. The mobile bundle downscales any background wider than 4096 because phone GPUs refuse to
 * upload a bigger texture (`海滩假日` rendered black for exactly that reason), and a 4096-wide
 * picture drawn 1:1 into a 5504-wide world leaves a third of the room unpainted.
 *
 * For a level split into `backgroundBlocks` the answer is the **cell** each block occupies, not
 * the whole world: 星空图书馆 is 11008x6144 built from four 5504x3072 paintings, and drawing each
 * 4096-wide block 1:1 left a 1488 px black gutter down every seam (`有好多黑边`).
 *
 * The cell is measured from the blocks themselves - the first positive gap between two distinct
 * x (and y) values - so a future layout does not need a matching constant.
 */
export function groundDisplaySize(
    level: Pick<Level, 'imageSize' | 'backgroundBlocks'>,
): { width: number; height: number } {
    const blocks = level.backgroundBlocks;
    if (!blocks || blocks.length === 0) {
        return { width: level.imageSize.width, height: level.imageSize.height };
    }

    const cells = (values: number[]): number => {
        const distinct = [...new Set(values)].sort((a, b) => a - b);
        return distinct.length > 1 ? distinct[1] - distinct[0] : 0;
    };

    const width = cells(blocks.map((block) => block.x));
    const height = cells(blocks.map((block) => block.y));
    return {
        width: width > 0 ? width : level.imageSize.width,
        height: height > 0 ? height : level.imageSize.height,
    };
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

/** Key a one-shot region trigger is remembered by: its level plus its id. */
export function triggerKey(levelId: string, triggerId: string): string {
    return `${levelId}:${triggerId}`;
}

/** A rectangular region of the world, in level coordinates. */
export interface TriggerZone {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Is a point inside a trigger's zone? The edges count as inside. */
export function isInsideZone(zone: TriggerZone, x: number, y: number): boolean {
    return x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;
}

/**
 * The triggers still armed this run.
 *
 * Unlike a broken prop — world state that outlives the run — a trigger is run
 * state: the beach juice is worth exactly one glass per run, so
 * `clearSaveData` starts a fresh run and the glass comes back. The key carries
 * the level id so two levels may each own a trigger called `lounger-juice`.
 */
export function armedTriggers<T extends { id: string }>(
    levelId: string,
    triggers: readonly T[] | undefined,
    usedTriggers: readonly string[],
): T[] {
    if (!triggers) return [];
    return triggers.filter(
        // A `travel` trigger is a door, so a recorded key must not close it. Older saves
        // were written while travel triggers WERE recorded, and those saves would keep the
        // boss level sealed forever - ignoring the record is what reopens it without asking
        // the player to start over.
        (trigger) => 'travel' in trigger || !usedTriggers.includes(triggerKey(levelId, trigger.id)),
    );
}

/** A point in the world. */
export interface Point {
    x: number;
    y: number;
}

/**
 * A point on a flown pickup's path: the straight line from `from` to `to`,
 * lifted by a parabola that peaks at `lift` px in the middle of the flight and
 * lands exactly on `to`. Screen coordinates, so the lift is negative y.
 */
export function arcPoint(from: Point, to: Point, t: number, lift: number): Point {
    const k = Math.min(Math.max(t, 0), 1);
    return {
        x: from.x + (to.x - from.x) * k,
        y: from.y + (to.y - from.y) * k - lift * 4 * k * (1 - k),
    };
}
