/**
 * tests/game/scenes/trigger-requires-clear.test.ts
 * --------------------------------------------------------------------------
 * A door that wants the map cleared stays shut while monsters are alive.
 *
 * The owner: `亚特兰蒂斯刷怪物+1波…全部打掉后…指向王座前往boss战`. Without the gate a player could
 * skip every wave by walking straight onto the throne.
 */

import { describe, expect, it } from 'vitest';

import { TriggerController } from '@/game/scenes/trigger';
import type { Level } from '@/lib/levels/types';

type Trigger = NonNullable<Level['triggers']>[number];
import type { DropSpec } from '@/lib/drops';

const ZONE = { x: 7976, y: 1296, width: 344, height: 444 };

const GATED: Trigger = {
    id: 'hidden-2-entry',
    zone: ZONE,
    travel: {
        targetScene: 'warhammer-redeem-1-chapel',
        excludeCharacters: ['claude'],
        requiresClear: true,
    },
} as unknown as Trigger;

const OPEN: Trigger = {
    id: 'plain-door',
    zone: ZONE,
    travel: { targetScene: 'somewhere', excludeCharacters: [], requiresClear: false },
} as unknown as Trigger;

function controller(trigger: Trigger, cleared: { value: boolean }, travelled: string[]) {
    const character = { body: { position: { x: ZONE.x + 10, y: ZONE.y + 10 } } };
    return new TriggerController(
        character as never,
        'dsh-atlantis-4-coronation-dais',
        [trigger],
        {} as never,
        (id) => ({ id }) as unknown as DropSpec,
        (sceneId) => travelled.push(sceneId),
        () => 'deepseek',
        () => undefined,
        () => cleared.value,
    );
}

describe('a requiresClear door', () => {
    it('does not open while the map is not clear', () => {
        const travelled: string[] = [];
        const controllerRef = controller(GATED, { value: false }, travelled);
        controllerRef.update(16);
        expect(travelled).toEqual([]);
    });

    it('opens the moment the map is clear', () => {
        const travelled: string[] = [];
        const cleared = { value: false };
        const controllerRef = controller(GATED, cleared, travelled);
        controllerRef.update(16);
        expect(travelled).toEqual([]);

        cleared.value = true;
        controllerRef.update(16);
        expect(travelled).toEqual(['warhammer-redeem-1-chapel']);
    });
});

describe('a door that does not ask', () => {
    it('opens immediately, cleared or not', () => {
        const travelled: string[] = [];
        const controllerRef = controller(OPEN, { value: false }, travelled);
        controllerRef.update(16);
        expect(travelled).toEqual(['somewhere']);
    });
});