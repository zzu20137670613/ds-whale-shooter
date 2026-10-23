/**
 * tests/game/scenes/trigger-travel.test.ts
 * --------------------------------------------------------------------------
 * The hidden door: a `travel` trigger, and the one rule that matters — Claude
 * must not be able to walk through it, and stepping on it as Claude must not
 * spend it either.
 *
 * That second half is the whole reason this file exists. The naive version
 * "fire, mark used" burns the entrance the first time a Claude run brushes the
 * zone, and nothing else in the game would ever tell you.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TriggerController } from '@/game/scenes/trigger';
import { parseLevelYaml } from '@/lib/levels/parser';
import { initialGameState, useGameStore } from '@/store/game-store';

const LEVEL_ID = 'dsh-atlantis';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);
const door = level.triggers!.find((t) => 'travel' in t)!;

const FRAME = 16;

/** Standing in the middle of the authored zone. */
const ON_THE_THRONE = {
    x: door.zone.x + door.zone.width / 2,
    y: door.zone.y + door.zone.height / 2,
};

function harness(characterId: string) {
    const character = { body: { position: { ...ON_THE_THRONE } } };
    const travelTo = vi.fn();
    const controller = new TriggerController(
        character,
        LEVEL_ID,
        level.triggers,
        { spawnLanded: vi.fn() } as never,
        () => {
            throw new Error('no drop should be built by a travel trigger');
        },
        travelTo,
        () => characterId,
    );
    return { controller, travelTo };
}

describe('TriggerController (the Atlantean throne door)', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('is authored as a travel trigger with Claude excluded', () => {
        expect(door.id).toBe('hidden-2-entry');
        expect('travel' in door).toBe(true);
        if (!('travel' in door)) return;
        expect(door.travel.targetScene).toBe('warhammer-redeem');
        expect(door.travel.excludeCharacters).toContain('claude');
    });

    it('takes anyone else straight to the arena', () => {
        const h = harness('deepseek');
        h.controller.update(FRAME);
        expect(h.travelTo).toHaveBeenCalledWith('warhammer-redeem');
        expect(useGameStore.getState().usedTriggers).toContain(`${LEVEL_ID}:hidden-2-entry`);
    });

    it('refuses Claude and leaves the door armed', () => {
        const h = harness('claude');
        h.controller.update(FRAME);
        expect(h.travelTo).not.toHaveBeenCalled();
        // The name must not be written: a Claude run may not burn the entrance.
        expect(useGameStore.getState().usedTriggers).toEqual([]);

        // And it still works the moment someone else is driving.
        const other = harness('deepseek');
        other.controller.update(FRAME);
        expect(other.travelTo).toHaveBeenCalledTimes(1);
    });

    it('does nothing while the player is away from the throne', () => {
        const character = { body: { position: { x: 0, y: 0 } } };
        const travelTo = vi.fn();
        const controller = new TriggerController(
            character,
            LEVEL_ID,
            level.triggers,
            { spawnLanded: vi.fn() } as never,
            () => {
                throw new Error('unreachable');
            },
            travelTo,
            () => 'deepseek',
        );
        controller.update(FRAME);
        expect(travelTo).not.toHaveBeenCalled();
    });
});
