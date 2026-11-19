/**
 * tests/game/drops/token-beam-anim-rebuild.test.ts
 * --------------------------------------------------------------------------
 * 光柱动画在**换场景之后**必须重建。
 *
 * 手机现场（2026-11-15 第二报）：`game:loop: Cannot read property 'sourceSize' of null`。
 * 动画是全局的，贴图是按场景加载/卸载的：离开关卡时 `releaseLoadedTextures` 会把
 * `token-beam-sheet` 从缓存里删掉，连带销毁它的 Frame（`frame.data = null`）；再进关卡，
 * `anims.exists()` 仍然为真，于是跳过重建，光柱继续播那份死帧 —— 渲染时读
 * `frame.sourceSize` 就炸了。
 */

import { describe, expect, it, vi } from 'vitest';

import {
    ensureTokenBeamAnim,
    TOKEN_BEAM_ANIM,
    TOKEN_BEAM_FRAME_COUNT,
} from '@/game/drops/token-beam';

interface FakeFrame {
    frame?: { data?: unknown };
}

function fakeAnims(existing?: { frames: FakeFrame[] }) {
    const anims = {
        exists: vi.fn(() => existing !== undefined),
        get: vi.fn(() => existing),
        remove: vi.fn(),
        create: vi.fn(),
    };
    return anims;
}

const liveFrames = (count: number): FakeFrame[] =>
    Array.from({ length: count }, () => ({ frame: { data: { sourceSize: { w: 128, h: 288 } } } }));

describe('ensureTokenBeamAnim', () => {
    it('builds the animation when none exists yet', () => {
        const anims = fakeAnims();

        ensureTokenBeamAnim({ anims } as never);

        expect(anims.create).toHaveBeenCalledTimes(1);
        expect(anims.remove).not.toHaveBeenCalled();
        expect(anims.create.mock.calls[0][0]).toMatchObject({ key: TOKEN_BEAM_ANIM, repeat: -1 });
        expect((anims.create.mock.calls[0][0] as { frames: unknown[] }).frames).toHaveLength(
            TOKEN_BEAM_FRAME_COUNT,
        );
    });

    it('keeps a healthy animation (same scene, second beam)', () => {
        const anims = fakeAnims({ frames: liveFrames(TOKEN_BEAM_FRAME_COUNT) });

        ensureTokenBeamAnim({ anims } as never);

        expect(anims.remove).not.toHaveBeenCalled();
        expect(anims.create).not.toHaveBeenCalled();
    });

    it('rebuilds after a scene switch destroyed the frames', () => {
        // 贴图被移除 → Frame.destroy() 把 data 置空；这就是手机上的现场。
        const dead = Array.from({ length: TOKEN_BEAM_FRAME_COUNT }, () => ({ frame: { data: null } }));
        const anims = fakeAnims({ frames: dead });

        ensureTokenBeamAnim({ anims } as never);

        expect(anims.remove).toHaveBeenCalledWith(TOKEN_BEAM_ANIM);
        expect(anims.create).toHaveBeenCalledTimes(1);
    });

    it('rebuilds when the frame count no longer matches', () => {
        const anims = fakeAnims({ frames: liveFrames(12) });

        ensureTokenBeamAnim({ anims } as never);

        expect(anims.remove).toHaveBeenCalledWith(TOKEN_BEAM_ANIM);
        expect(anims.create).toHaveBeenCalledTimes(1);
    });
});