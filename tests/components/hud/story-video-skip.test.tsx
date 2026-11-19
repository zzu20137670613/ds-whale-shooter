// @vitest-environment happy-dom
/**
 * tests/components/hud/story-video-skip.test.tsx
 * --------------------------------------------------------------------------
 * 「视频在播、跳过按钮看得见，点它却没有任何反应」—— 主人 2026-11-16 在网页上遇到的。
 *
 * 线上抓到的真实现场：
 *
 *     TypeError: Cannot read properties of null (reading 'queueOp')
 *         at ScenePlugin2.resume (phaser.js)
 *         at story-video.tsx  ← stop() 里的 scene.resume()
 *         at onclick          ← 跳过按钮
 *
 * 片子还在播，关卡已经被整个换掉了：`scene.scene`（ScenePlugin）还在对象上，`scene.sys`
 * 已经是 null。旧实现先在 `resume()` 这步抛出来，`setSrc(null)` 永远执行不到，而
 * `finishedRef` 已经置真 —— 之后每一次点击都在第一行被挡回去。
 *
 * 现在：撤画面永远第一件事；场景只在还活着（`sys` 非空）时才恢复；收尾每一步各自兜底。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { StoryVideo } from '@/components/hud/story-video';
import { MUSIC_RESUME, PLAY_STORY_VIDEO_EVENT, STORY_VIDEO_DONE_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';

const scene = vi.hoisted(() => ({
    alive: true,
    paused: { pause: vi.fn(), resume: vi.fn() },
}));

vi.mock('@/lib/phaser-game', () => ({
    getPhaserGame: () => ({
        scene: {
            getScenes: () => [
                {
                    scene: scene.paused,
                    // 用 getter 读当前值：场景可能在片子播到一半时才被销毁。
                    get sys() {
                        // 被换掉的关卡：`sys` 是 null，`ScenePlugin.resume()` 会抛 queueOp。
                        return scene.alive ? { isActive: () => true } : null;
                    },
                },
            ],
        },
    }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('the cut-scene skip', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    const videoOnScreen = () => container.querySelector('[data-testid="story-video"]');
    const play = (src: string) =>
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src });
        });
    const clickSkip = () =>
        act(() => {
            (container.querySelector('[data-testid="story-video-skip"]') as HTMLButtonElement).click();
        });
    const clickPicture = () =>
        act(() => {
            (videoOnScreen() as HTMLElement).click();
        });

    beforeEach(() => {
        scene.alive = true;
        scene.paused = { pause: vi.fn(), resume: vi.fn() };
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => root.render(<StoryVideo />));
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        EventBus.removeAllListeners(STORY_VIDEO_DONE_EVENT);
        EventBus.removeAllListeners(PLAY_STORY_VIDEO_EVENT);
        EventBus.removeAllListeners(MUSIC_RESUME);
        vi.clearAllMocks();
    });

    it('closes on the button', () => {
        play('assets/video/holding-hands.mp4');
        expect(videoOnScreen()).not.toBeNull();
        clickSkip();
        expect(videoOnScreen()).toBeNull();
    });

    it('closes on a click anywhere on the picture', () => {
        play('assets/video/holding-hands.mp4');
        clickPicture();
        expect(videoOnScreen()).toBeNull();
    });

    it('closes when the level was swapped out mid-clip', () => {
        play('assets/video/holding-hands.mp4');
        // 片子在播的时候关卡没了 —— 线上就是这一步抛的 queueOp。
        scene.alive = false;
        clickSkip();
        expect(videoOnScreen()).toBeNull();
        // 已经没有场景要恢复，就不该再去碰它。
        expect(scene.paused.resume).not.toHaveBeenCalled();
    });

    it('still closes the second clip after the first one ended on its own', () => {
        play('assets/video/night-of-dragons.mp4');
        act(() => {
            (container.querySelector('[data-testid="story-video-player"]') as HTMLVideoElement)
                .dispatchEvent(new Event('ended'));
        });
        expect(videoOnScreen()).toBeNull();

        play('assets/video/holding-hands.mp4');
        expect(videoOnScreen()).not.toBeNull();
        clickSkip();
        expect(videoOnScreen()).toBeNull();
    });

    it('closes even when the hand-off back to the game throws', () => {
        const poisoned = () => {
            throw new Error('music resume blew up');
        };
        EventBus.on(MUSIC_RESUME, poisoned);
        play('assets/video/holding-hands.mp4');
        clickSkip();
        expect(videoOnScreen()).toBeNull();
    });

    it('closes on Escape too', () => {
        play('assets/video/holding-hands.mp4');
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(videoOnScreen()).toBeNull();
    });

    it('emits DONE once per clip, even if the skip is hammered', () => {
        const done = vi.fn();
        EventBus.on(STORY_VIDEO_DONE_EVENT, done);
        play('assets/video/holding-hands.mp4');
        const button = container.querySelector(
            '[data-testid="story-video-skip"]',
        ) as HTMLButtonElement;
        act(() => {
            button.click();
        });
        act(() => {
            button.click();
        });
        expect(done).toHaveBeenCalledTimes(1);
        EventBus.off(STORY_VIDEO_DONE_EVENT, done);
    });
});