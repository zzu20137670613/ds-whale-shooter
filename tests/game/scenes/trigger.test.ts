/**
 * tests/game/scenes/trigger.test.ts
 * --------------------------------------------------------------------------
 * The beach lounger's juice, driven through the level's **real** coordinates.
 *
 * Why this file exists: the pure helpers (`armedTriggers` / `isInsideZone` /
 * `arcPoint`) are tested next to their source, which proves the arithmetic but
 * not the thing the player cares about — that standing on the painted lounger
 * in `beach-holiday.yaml` makes a glass appear on the side table, once per run.
 * A zone that has drifted off the art still passes every unit test, so this
 * one reads the shipped YAML and asserts against those numbers.
 *
 * The scene, the character and the drop controller are fakes: this is the
 * controller's logic, not Phaser's renderer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TriggerController } from '@/game/scenes/trigger';
import { parseLevelYaml } from '@/lib/levels/parser';
import { initialGameState, useGameStore } from '@/store/game-store';
import type { DropSpec } from '@/lib/drops';

const LEVEL_ID = 'beach-holiday';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);
const trigger = level.triggers![0];

/** The drop spec is only an identity token here — the fake controller ignores it. */
const spec = { id: 'beach-drink' } as DropSpec;

function harness() {
    const sprite = { setPosition: vi.fn(), setDepth: vi.fn() };
    const drop = { sprite, rejected: false };
    const spawnLanded = vi.fn(() => drop);
    const line = {
        setDepth: vi.fn(),
        lineStyle: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokePath: vi.fn(),
        destroy: vi.fn(),
        alpha: 1,
    };
    const scene = {
        add: { graphics: vi.fn(() => line) },
        tweens: {
            addCounter: vi.fn((config: unknown) => ({ stop: vi.fn(), config })),
            add: vi.fn((config: unknown) => ({ stop: vi.fn(), config })),
        },
    };
    const character = { body: { position: { x: 0, y: 0 } } };
    const controller = new TriggerController(
        scene as never,
        character,
        LEVEL_ID,
        level.triggers,
        { spawnLanded } as never,
        () => spec,
    );
    return { controller, character, spawnLanded, sprite, drop, scene, line };
}

/** Where the player stands to set the egg off: the middle of the authored zone. */
const ON_THE_CHAIR = {
    x: trigger.zone.x + trigger.zone.width / 2,
    y: trigger.zone.y + trigger.zone.height / 2,
};

describe('TriggerController (the lounger juice)', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('reads a lounger trigger out of the shipped level', () => {
        expect(trigger.id).toBe('lounger-juice');
        expect(trigger.spawn.type).toBe('beach-drink');
        expect(trigger.zone.width).toBeGreaterThan(0);
        expect(trigger.zone.height).toBeGreaterThan(0);
    });

    it('does nothing while the player is away from the lounger', () => {
        const h = harness();
        h.character.body.position = { x: 1000, y: 1000 };
        h.controller.update();
        expect(h.spawnLanded).not.toHaveBeenCalled();
        expect(useGameStore.getState().usedTriggers).toEqual([]);
    });

    it('lands the glass on the table and remembers the egg once the player steps on the chair', () => {
        const h = harness();
        h.character.body.position = { ...ON_THE_CHAIR };
        h.controller.update();
        expect(h.spawnLanded).toHaveBeenCalledWith(spec, trigger.spawn.to.x, trigger.spawn.to.y);
        expect(useGameStore.getState().usedTriggers).toEqual([`${LEVEL_ID}:lounger-juice`]);
    });

    it('flies the glass from the lounger to the table, then releases it for pickup', () => {
        const h = harness();
        h.character.body.position = { ...ON_THE_CHAIR };
        h.controller.update();

        // It starts where it pops out, and the magnet is held off in flight.
        expect(h.sprite.setPosition).toHaveBeenCalledWith(
            trigger.spawn.from.x,
            trigger.spawn.from.y,
        );
        expect(h.drop.rejected).toBe(true);
        expect(h.scene.add.graphics).toHaveBeenCalledTimes(1);

        const config = h.scene.tweens.addCounter.mock.calls[0][0] as {
            duration: number;
            onUpdate: (tween: { getValue: () => number }) => void;
            onComplete: () => void;
        };
        expect(config.duration).toBe(trigger.spawn.durationMs);

        config.onUpdate({ getValue: () => 0.5 });
        const mid = h.sprite.setPosition.mock.calls.at(-1)!;
        expect(mid[0]).toBeCloseTo((trigger.spawn.from.x + trigger.spawn.to.x) / 2);
        expect(mid[1]).toBeLessThan(trigger.spawn.from.y);

        config.onComplete();
        expect(h.sprite.setPosition).toHaveBeenLastCalledWith(
            trigger.spawn.to.x,
            trigger.spawn.to.y,
        );
        expect(h.drop.rejected).toBe(false);
    });

    it('never fires twice in the same run', () => {
        const h = harness();
        h.character.body.position = { ...ON_THE_CHAIR };
        h.controller.update();
        h.controller.update();
        expect(h.spawnLanded).toHaveBeenCalledTimes(1);
    });

    it('fires again once the save is cleared — a fresh run earns a fresh glass', () => {
        const first = harness();
        first.character.body.position = { ...ON_THE_CHAIR };
        first.controller.update();

        useGameStore.getState().clearSaveData();

        const second = harness();
        second.character.body.position = { ...ON_THE_CHAIR };
        second.controller.update();
        expect(second.spawnLanded).toHaveBeenCalledTimes(1);
    });

    it('tears its flights down on shutdown', () => {
        const h = harness();
        h.character.body.position = { ...ON_THE_CHAIR };
        h.controller.update();
        const config = h.scene.tweens.addCounter.mock.calls[0][0] as never;
        const flight = h.scene.tweens.addCounter.mock.results[0].value as { stop: () => void };
        expect(config).toBeTruthy();
        h.controller.destroy();
        expect(flight.stop).toHaveBeenCalled();
    });
});
