/**
 * tests/game/merchant/merchant-cat.test.ts
 * --------------------------------------------------------------------------
 * The 创世线 cat, checked against the merchant controller that actually draws her.
 *
 * The emulator can show the merchant (and therefore the cat) only after a level is cleared, and
 * there is no debug switch to clear one - so the wiring is pinned here instead, with a stub scene
 * that records what the controller asks Phaser to draw.
 *
 * The three things that could silently go wrong:
 *   1. the merchant never steps left, so the cat lands on top of her;
 *   2. the cat is drawn at the wrong size (the owner: `高度等比缩放为神秘商人高度的一半`);
 *   3. the cat is drawn but not clickable, so her CDK line is unreachable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The controller only uses Phaser for types; the stub keeps the runtime out of happy-dom.
vi.mock('phaser', () => ({}));
vi.mock('@/game/hubs/base-hub', () => ({ hudFitScale: () => 1 }));

import { MERCHANT_DISPLAY_HEIGHT, MERCHANT_TEXTURE_KEY } from '@/lib/constants';
import { MerchantController } from '@/game/merchant/merchant-controller';
import { EPILOGUE_CAT_TEXTURE_KEY, EPILOGUE_CATS } from '@/lib/story/epilogue-npcs';
import { useGameStore } from '@/store/game-store';

/** The painted world the controller thinks it is standing in. */
const IMAGE = { width: 11008, height: 6144 };
const JUNCTION = { x: IMAGE.width / 2, y: IMAGE.height / 2 };

/** Texture sizes the controller reads back through `textures.get(...)`. */
const TEXTURES: Record<string, { width: number; height: number }> = {
    [MERCHANT_TEXTURE_KEY]: { width: 520, height: 900 },
    [EPILOGUE_CAT_TEXTURE_KEY]: { width: 108, height: 150 },
};

interface FakeSprite {
    kind: 'sprite';
    key: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    displayWidth: number;
    handlers: Record<string, () => void>;
    destroyed: boolean;
}

function makeSprite(
    key: string,
    x: number,
    y: number,
    size: { width: number; height: number },
): FakeSprite {
    const sprite: FakeSprite = {
        kind: 'sprite',
        key,
        x,
        y,
        width: size.width,
        height: size.height,
        scale: 1,
        get displayWidth() {
            return this.width * this.scale;
        },
        handlers: {},
        destroyed: false,
    };
    const chain = {
        setOrigin: () => chain,
        setScale: (value: number) => {
            sprite.scale = value;
            return chain;
        },
        setDepth: () => chain,
        setInteractive: () => chain,
        setResolution: () => chain,
        on: (event: string, handler: () => void) => {
            sprite.handlers[event] = handler;
            return chain;
        },
        destroy: () => {
            sprite.destroyed = true;
        },
    };
    return Object.assign(sprite, chain);
}

function makeScene() {
    const drawn: FakeSprite[] = [];
    const scene = {
        add: {
            sprite: (x: number, y: number, key: string) => {
                const sprite = makeSprite(key, x, y, TEXTURES[key] ?? { width: 10, height: 10 });
                drawn.push(sprite);
                return sprite;
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
    };
    return { scene, drawn };
}

describe('the merchant and her cat on the junction', () => {
    beforeEach(() => {
        useGameStore.setState({ merchantReady: false });
    });

    it('draws the merchant and her cat as two sprites', () => {
        const { scene, drawn } = makeScene();
        const cat = EPILOGUE_CATS['starry-library-4-scroll'];
        const controller = new MerchantController(scene as never, IMAGE, () => true, cat);
        (controller as unknown as { spawn: () => void }).spawn();

        expect(drawn.map((s) => s.key)).toEqual([MERCHANT_TEXTURE_KEY, EPILOGUE_CAT_TEXTURE_KEY]);
    });

    it('steps the merchant left by half her own width', () => {
        const { scene, drawn } = makeScene();
        const controller = new MerchantController(
            scene as never,
            IMAGE,
            () => true,
            EPILOGUE_CATS['starry-library-4-scroll'],
        );
        (controller as unknown as { spawn: () => void }).spawn();

        const merchant = drawn[0];
        // 520 x 900 drawn at 300 tall -> 173.3 wide, so half of that.
        const expectedWidth = (520 * MERCHANT_DISPLAY_HEIGHT) / 900;
        expect(merchant.x).toBe(Math.round(JUNCTION.x - expectedWidth / 2));
    });

    it('stands the cat at half the merchant height, feet on the same line', () => {
        const { scene, drawn } = makeScene();
        const controller = new MerchantController(
            scene as never,
            IMAGE,
            () => true,
            EPILOGUE_CATS['starry-library-4-scroll'],
        );
        (controller as unknown as { spawn: () => void }).spawn();

        const cat = drawn[1];
        // The cat texture is already 150 tall, so a 150 px cat is drawn at scale 1.
        expect(cat.scale * cat.height).toBeCloseTo(MERCHANT_DISPLAY_HEIGHT / 2, 6);
        expect(cat.y).toBe(JUNCTION.y);
        expect(cat.x).toBeGreaterThan(drawn[0].x);
    });

    it('lets her shoulders touch the merchant without overlapping', () => {
        const { scene, drawn } = makeScene();
        const controller = new MerchantController(
            scene as never,
            IMAGE,
            () => true,
            EPILOGUE_CATS['starry-library-4-scroll'],
        );
        (controller as unknown as { spawn: () => void }).spawn();

        const merchant = drawn[0];
        const cat = drawn[1];
        const merchantRight = merchant.x + (merchant.width * merchant.scale) / 2;
        const catLeft = cat.x - (cat.width * cat.scale) / 2;
        expect(catLeft).toBeGreaterThanOrEqual(merchantRight - 1);
    });

    it('says her CDK line when tapped', () => {
        const { scene, drawn } = makeScene();
        const cat = EPILOGUE_CATS['starry-library-4-scroll'];
        const controller = new MerchantController(scene as never, IMAGE, () => true, cat);
        (controller as unknown as { spawn: () => void }).spawn();

        const spoken: string[] = [];
        const original = useGameStore.getState().showNotice;
        useGameStore.setState({
            showNotice: (text: string) => {
                spoken.push(text);
            },
        });
        try {
            drawn[1].handlers.pointerdown?.();
        } finally {
            useGameStore.setState({ showNotice: original });
        }
        expect(spoken).toEqual([cat.line]);
    });

    it('draws no cat before the ending', () => {
        const { scene, drawn } = makeScene();
        const controller = new MerchantController(scene as never, IMAGE, () => true, null);
        (controller as unknown as { spawn: () => void }).spawn();
        expect(drawn).toHaveLength(1);
    });
});
