/**
 * tests/game/scenes/trigger-travel.test.ts
 * --------------------------------------------------------------------------
 * The hidden door: a `travel` trigger, and the two rules that matter.
 *
 *   1. Anyone may walk through it - Claude included. The owner removed the old
 *      `excludeCharacters: [claude]` (2026-11-12: `我们最早设计的是 Claude 踩亚特兰蒂斯的
 *      王座时不会触发 boss 战，让你去掉的是这个`).
 *   2. A door is not a reward. `hidden-2-entry` used to be written to `usedTriggers` when it
 *      fired, so entering the boss level once - and then dying or settling out of it - left
 *      the entrance spent for the rest of the save (the owner: `在亚特兰蒂斯踩龙王宝座时进不去
 *      boss关了`). Travel triggers are deliberately NOT recorded; reward triggers still are.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TriggerController } from '@/game/scenes/trigger';
import { parseLevelYaml } from '@/lib/levels/parser';
import { initialGameState, useGameStore } from '@/store/game-store';

const LEVEL_ID = 'dsh-atlantis-4-coronation-dais';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);
const door = level.triggers!.find((t) => 'travel' in t)!;

/** The sky city's one reward trigger: the dragon fangs, GPT only. */
const SKY_ID = 'gpt-sky-city-4-throne-hall';
const skyLevel = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${SKY_ID}.yaml`), 'utf8'),
    SKY_ID,
);
const fangs = skyLevel.triggers!.find((t) => 'spawn' in t)!;

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
        undefined,
        // The throne now waits for a cleared map (`requiresClear: true`); these tests are
        // about the character rule, so the map is already clear.
        () => true,
    );
    return { controller, travelTo };
}

describe('TriggerController (the Atlantean throne door)', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('is authored as a travel trigger that excludes nobody', () => {
        expect(door.id).toBe('hidden-2-entry');
        expect('travel' in door).toBe(true);
        if (!('travel' in door)) return;
        expect(door.travel.targetScene).toBe('warhammer-redeem-1-chapel');
        // 2026-11-12：王座不再把 Claude 拦在门外。
        expect(door.travel.excludeCharacters).toEqual([]);
    });

    it('takes anyone else straight to the arena', () => {
        const h = harness('deepseek');
        h.controller.update(FRAME);
        expect(h.travelTo).toHaveBeenCalledWith('warhammer-redeem-1-chapel');
    });

    it('does not record itself as used, so the door opens again next visit', () => {
        const first = harness('deepseek');
        first.controller.update(FRAME);
        expect(first.travelTo).toHaveBeenCalledTimes(1);

        // This is the assertion that used to be the bug: the door was written down, and a
        // fresh controller built from the save found nothing to fire.
        expect(useGameStore.getState().usedTriggers).not.toContain(`${LEVEL_ID}:hidden-2-entry`);

        // Walk back to the throne after dying in there: it still works.
        const second = harness('deepseek');
        second.controller.update(FRAME);
        expect(second.travelTo).toHaveBeenCalledWith('warhammer-redeem-1-chapel');
    });

    it('fires once per visit, not once per frame', () => {
        const h = harness('deepseek');
        h.controller.update(FRAME);
        h.controller.update(FRAME);
        h.controller.update(FRAME);
        expect(h.travelTo).toHaveBeenCalledTimes(1);
    });

    it('opens even when an old save already recorded it as used', () => {
        // Saves written before this fix carry `dsh-atlantis-4-coronation-dais:hidden-2-entry` in usedTriggers.
        // The door must ignore that record rather than stay shut until the player starts a
        // new game.
        useGameStore.setState({ usedTriggers: [`${LEVEL_ID}:hidden-2-entry`] });
        const h = harness('deepseek');
        h.controller.update(FRAME);
        expect(h.travelTo).toHaveBeenCalledWith('warhammer-redeem-1-chapel');
    });

    it('takes Claude into the arena too', () => {
        // 主人 2026-11-12：`我们最早设计的是 Claude 踩王座不会触发 boss 战，让你去掉的是这个`。
        // 现在谁踩都进；进关之后由 `character: deepseek` 把人换成鲸娘。
        const h = harness('claude');
        h.controller.update(FRAME);
        expect(h.travelTo).toHaveBeenCalledWith('warhammer-redeem-1-chapel');
        // 传送门本来就不写 usedTriggers，Claude 也不该例外。
        expect(useGameStore.getState().usedTriggers).toEqual([]);
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

describe('a reward trigger is still one per run', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('records itself as used when it fires', () => {
        const zone = fangs.zone;
        const character = {
            body: { position: { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 } },
        };
        const controller = new TriggerController(
            character,
            SKY_ID,
            skyLevel.triggers,
            { spawnLanded: () => ({ rejected: false }), spawnWeaponLanded: () => ({ rejected: false }) } as never,
            () => ({}) as never,
            undefined,
            () => 'gpt',
            () => ({}) as never,
        );

        controller.update(FRAME);

        // The throne is `perCharacter`, so its key ends with the character id.
        expect(
            useGameStore.getState().usedTriggers.some((k) => k.startsWith(`${SKY_ID}:${fangs.id}`)),
        ).toBe(true);
    });
});