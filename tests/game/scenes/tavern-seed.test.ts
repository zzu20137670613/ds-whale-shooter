/**
 * tests/game/scenes/tavern-seed.test.ts
 * --------------------------------------------------------------------------
 * seed in the pavilion, checked against the controller that actually draws her.
 *
 * The owner: `seed的立绘在选人阶段也不显示，在boss战结束、制作不易返回之后自动显示，
 * 触发点设为boss战结束之后这几项动作的任意一个，跟猫猫的逻辑一样，boss打完之前不显示`.
 *
 * So there are exactly three rules, and each one has a way to go wrong that a screenshot after a
 * full playthrough would catch too late:
 *   1. before the boss, she is not there - at all, in either phase;
 *   2. the character-select screen (phase 1) does not show her either - returning from the
 *      support panel lands in phase 2, which is where she belongs;
 *   3. phase 2 does show her once the boss is down, and clicking her opens the time gate.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The controller only uses Phaser for types; the stub keeps the runtime out of happy-dom.
vi.mock('phaser', () => ({
    Input: { Keyboard: { KeyCodes: { A: 65, D: 68, F: 70, LEFT: 37, RIGHT: 39 } } },
}));

import { SEED_SHOP_EVENT } from '@/lib/constants';
import { SEED_DISPLAY_HEIGHT, SEED_TEXTURE_KEY } from '@/lib/story/epilogue-npcs';
import { EventBus } from '@/lib/events/bus';
import { TavernController } from '@/game/scenes/tavern-controller';
import { useGameStore } from '@/store/game-store';

const TEXTURES: Record<string, { width: number; height: number }> = {
    [SEED_TEXTURE_KEY]: { width: 330, height: 520 },
};

interface FakeSprite {
    key: string;
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
    handlers: Record<string, () => void>;
}

function makeScene() {
    const drawn: FakeSprite[] = [];
    const scene = {
        game: { canvas: null },
        add: {
            sprite: (x: number, y: number, key: string) => {
                const size = TEXTURES[key] ?? { width: 10, height: 10 };
                const sprite: FakeSprite = {
                    key,
                    x,
                    y,
                    scale: 1,
                    width: size.width,
                    height: size.height,
                    handlers: {},
                };
                const chain = {
                    setOrigin: () => chain,
                    setScale: (value: number) => {
                        sprite.scale = value;
                        return chain;
                    },
                    setDepth: () => chain,
                    setInteractive: () => chain,
                    on: (event: string, handler: () => void) => {
                        sprite.handlers[event] = handler;
                        return chain;
                    },
                    destroy: () => {},
                };
                drawn.push(sprite);
                return Object.assign(sprite, chain);
            },
            ellipse: () => ({ setDepth: () => ({}) }),
            text: () => {
                const chain = {
                    setResolution: () => chain,
                    setOrigin: () => chain,
                    setScale: () => chain,
                    setDepth: () => chain,
                };
                return chain;
            },
        },
        textures: {
            exists: (key: string) => key in TEXTURES,
            get: (key: string) => ({ getSourceImage: () => TEXTURES[key] }),
        },
        events: { on: () => {}, once: () => {}, off: () => {} },
        input: {
            keyboard: {
                addKey: () => ({ isDown: false, on: () => {}, off: () => {} }),
                on: () => {},
                off: () => {},
            },
            on: () => {},
            off: () => {},
        },
    };
    return { scene, drawn };
}

const LEVEL = {
    id: 'tavern',
    tavern: true,
    imageSize: { width: 2752, height: 1536 },
    npcSpawns: [],
} as never;

const ASSETS = { allCharacters: [] } as never;

function build(phase: 'selection' | 'pickup') {
    const { scene, drawn } = makeScene();
    const controller = new TavernController(scene as never, LEVEL, ASSETS, () => {}, phase);
    return { controller, drawn };
}

const seedSprites = (drawn: FakeSprite[]) => drawn.filter((s) => s.key === SEED_TEXTURE_KEY);

describe('seed in the pavilion', () => {
    beforeEach(() => {
        useGameStore.setState({ endingCleared: false });
    });

    it('is absent before the boss is down, in the selection phase', () => {
        const { drawn } = build('selection');
        expect(seedSprites(drawn)).toHaveLength(0);
    });

    it('is absent before the boss is down, in the weapon-pickup phase', () => {
        const { drawn } = build('pickup');
        expect(seedSprites(drawn)).toHaveLength(0);
    });

    it('stays off the character-select screen after the boss', () => {
        // She belongs to the pavilion the player walks back into, not to the pick-a-girl ring.
        useGameStore.setState({ endingCleared: true });
        const { drawn } = build('selection');
        expect(seedSprites(drawn)).toHaveLength(0);
    });

    it('is standing in the pavilion once the boss is down', () => {
        useGameStore.setState({ endingCleared: true });
        const { drawn } = build('pickup');
        const seeds = seedSprites(drawn);
        expect(seeds).toHaveLength(1);
        // Half the old 300: she was towering over the deck chairs.
        expect(seeds[0].height * seeds[0].scale).toBeCloseTo(SEED_DISPLAY_HEIGHT, 0);
    });

    it('opens the time gate when clicked', () => {
        useGameStore.setState({ endingCleared: true });
        const { drawn } = build('pickup');
        const heard: unknown[] = [];
        const onShop = () => heard.push('opened');
        EventBus.on(SEED_SHOP_EVENT, onShop);

        seedSprites(drawn)[0].handlers.pointerdown();

        EventBus.off(SEED_SHOP_EVENT, onShop);
        expect(heard).toEqual(['opened']);
    });
});
