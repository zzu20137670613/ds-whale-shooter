/**
 * tests/game/drops/token-beam-create.test.ts
 * --------------------------------------------------------------------------
 * 真的把光柱摆一次。
 *
 * 2026-11-15 的手机崩溃（`monster:died: Phaser is not defined`）就发生在这里：
 * `createTokenBeam` 用了 `Phaser.BlendModes`，而那个文件没有 import Phaser —— 类型是全局
 * 命名空间，`tsc` 查不出来，运行时却是 ReferenceError。之前的光柱测试只测纯函数
 * （配色、tone 归属），从来没调用过这个函数，所以一路绿灯。
 *
 * 这个测试就做一件事：用最小假场景调一次，不许抛。
 */

import { describe, expect, it, vi } from 'vitest';

import { createTokenBeam, TOKEN_BEAM_ANIM } from '@/game/drops/token-beam';

function fakeScene(withTexture: boolean) {
    const sprite = {
        setOrigin: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis(),
    };
    const rect = {
        setOrigin: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
    };
    const glow = {
        setBlendMode: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
    };
    const scene = {
        anims: { exists: () => false, get: () => undefined, remove: vi.fn(), create: vi.fn() },
        textures: { exists: () => withTexture },
        add: {
            sprite: vi.fn(() => sprite),
            rectangle: vi.fn(() => rect),
            ellipse: vi.fn(() => glow),
        },
        tweens: { add: vi.fn() },
    };
    return { scene, sprite, rect, glow };
}

describe('createTokenBeam', () => {
    it('places the beam for a gold drop without throwing', () => {
        const { scene, sprite } = fakeScene(true);

        const handles = createTokenBeam(scene as never, 640, 480, 'gold');

        expect(handles.beam).toBe(sprite);
        expect(sprite.play).toHaveBeenCalledWith(TOKEN_BEAM_ANIM);
        expect(scene.tweens.add).toHaveBeenCalledTimes(2);
    });

    it('falls back to the plain rectangle when the sheet is missing', () => {
        const { scene, rect } = fakeScene(false);

        const handles = createTokenBeam(scene as never, 10, 20, 'violet');

        expect(handles.beam).toBe(rect as never);
        expect(scene.add.sprite).not.toHaveBeenCalled();
    });

    it('works for every tone (each reads its own palette)', () => {
        for (const tone of ['gold', 'violet', 'bright'] as const) {
            const { scene } = fakeScene(true);
            expect(() => createTokenBeam(scene as never, 0, 0, tone)).not.toThrow();
        }
    });
});