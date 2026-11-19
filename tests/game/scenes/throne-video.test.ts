/**
 * tests/game/scenes/throne-video.test.ts
 * --------------------------------------------------------------------------
 * 一夜鱼龙舞, fired by standing on the throne.
 *
 * The emulator can be walked around but not through nine guards, so this is the one part of the
 * cut-scene chain that cannot be reached by hand: YAML zone -> TriggerController -> the event the
 * video player listens to. Everything here runs the REAL controller against a stub scene, so the
 * wiring is exercised rather than described.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({}));

import { PLAY_STORY_VIDEO_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { TriggerController } from '@/game/scenes/trigger';
import { useGameStore } from '@/store/game-store';

/** The throne trigger, copied from `gpt-sky-city-4-throne-hall.yaml`. */
const THRONE = {
    id: 'dragon-throne-fangs',
    zone: { x: 7950, y: 4430, width: 720, height: 360 },
    line: { default: '哇！GPT藏起来的白龙獠牙，好漂亮的枪！' },
    video: 'assets/video/night-of-dragons.mp4',
    spawn: {
        type: 'weapon-drop',
        weaponId: 'white-dragon-fangs',
        from: { x: 8282, y: 3560 },
        to: { x: 8282, y: 4620 },
        lift: 120,
        durationMs: 750,
    },
};

const IN_ZONE = { x: 8300, y: 4600 };
const OUT_OF_ZONE = { x: 2000, y: 2000 };

function makeDropController(mode: 'ok' | 'throws') {
    return {
        spawnWeaponLanded: () => {
            if (mode === 'throws') throw new Error('no sprite for the fang');
            return {
                rejected: false,
                sprite: {
                    setPosition: () => {},
                    setDepth: () => {},
                },
            };
        },
        spawnLanded: () => {
            throw new Error('not used');
        },
    };
}

function controllerFor(position: { x: number; y: number }, dropsMode: 'ok' | 'throws' = 'ok') {
    const character = { body: { position: { x: position.x, y: position.y } } };
    return new TriggerController(
        character as never,
        'gpt-sky-city-4-throne-hall',
        [THRONE as never],
        makeDropController(dropsMode) as never,
        () => ({}) as never,
        undefined,
        () => 'deepseek',
        () => ({ id: 'white-dragon-fangs' }) as never,
        () => true,
    );
}

const tick = (controller: TriggerController) => controller.update(16) as unknown as void;

const heard: string[] = [];

// One listener for the whole file: `beforeEach` cannot return a cleanup, and re-registering per
// test left every earlier listener alive, which made the counts accumulate.
EventBus.on(PLAY_STORY_VIDEO_EVENT, (payload?: { src?: string }) => {
    heard.push(payload?.src ?? '');
});

describe('standing on the dragon throne', () => {
    beforeEach(() => {
        useGameStore.setState({ usedTriggers: [] });
        heard.length = 0;
    });

    it('plays 一夜鱼龙舞 when the player is on the seat', () => {
        const controller = controllerFor(IN_ZONE);
        tick(controller);
        expect(heard).toEqual(['assets/video/night-of-dragons.mp4']);
    });

    it('stays quiet when the player is elsewhere', () => {
        const controller = controllerFor(OUT_OF_ZONE);
        tick(controller);
        expect(heard).toEqual([]);
    });

    it('plays the clip even when the fang cannot be built', () => {
        // The moment belongs to the throne, not to the reward: a drop that throws must not eat
        // the cut-scene. The exception is logged and the reward is lost, which is the old
        // behaviour - the video is what the owner asked for.
        const controller = controllerFor(IN_ZONE, 'throws');
        expect(() => tick(controller)).not.toThrow();
        expect(heard).toEqual(['assets/video/night-of-dragons.mp4']);
    });

    it('plays it once and spends the trigger', () => {
        const controller = controllerFor(IN_ZONE);
        tick(controller);
        tick(controller);
        expect(heard).toHaveLength(1);
        expect(useGameStore.getState().usedTriggers).toContain('gpt-sky-city-4-throne-hall:dragon-throne-fangs');
    });

    it('does not fire again on a later visit', () => {
        const controller = controllerFor(IN_ZONE);
        tick(controller);
        const nextVisit = controllerFor(IN_ZONE);
        tick(nextVisit);
        expect(heard).toHaveLength(1);
    });
});
