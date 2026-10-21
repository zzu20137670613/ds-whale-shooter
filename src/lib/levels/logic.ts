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
    return triggers.filter((trigger) => !usedTriggers.includes(triggerKey(levelId, trigger.id)));
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
