// @vitest-environment happy-dom
/**
 * tests/components/hud/story-video.test.tsx
 * --------------------------------------------------------------------------
 * Two cut-scenes: 一夜鱼龙舞 at the throne, 牵手 in the ending.
 *
 * The owner's playback rules: `加「点击跳过」，带声音（播放时BGM 取消，用视频原声）`. The
 * hand-off matters too: whatever waits behind a video must run on a skip as well, or tapping
 * 跳过 would swallow the rest of the ending.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { StoryVideo } from '@/components/hud/story-video';
import {
    MUSIC_PAUSE,
    MUSIC_RESUME,
    PLAY_STORY_VIDEO_EVENT,
    STORY_VIDEO_DONE_EVENT,
} from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';

const pause = vi.fn();
const resume = vi.fn();
vi.mock('@/lib/phaser-game', () => ({
    getPhaserGame: () => ({
        // `sys` 是"这个场景还活着吗"的判据：`story-video` 只在它非空时才暂停/恢复
        // （场景被换掉后 `ScenePlugin.resume()` 会抛 queueOp）。
        scene: { getScenes: () => [{ scene: { pause, resume }, sys: { isActive: () => true } }] },
    }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('the cut-scene player', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
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
        vi.clearAllMocks();
    });

    it('shows nothing until a video is asked for', () => {
        expect(container.querySelector('[data-testid="story-video"]')).toBeNull();
    });

    it('plays the file it is handed, with sound', () => {
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/night-of-dragons.mp4' });
        });
        const video = container.querySelector(
            '[data-testid="story-video-player"]',
        ) as HTMLVideoElement;
        expect(video).not.toBeNull();
        expect(video.getAttribute('src')).toBe('assets/video/night-of-dragons.mp4');
        // Muted would break `用视频原声`.
        expect(video.muted).toBe(false);
    });

    it('falls back to muted playback when the browser refuses sound', async () => {
        // Neither clip starts on a tap, so unmuted autoplay can be refused outright. A silent
        // picture is bad; a frozen first frame reads as a crash.
        const element = container.querySelector('[data-testid="story-video-player"]');
        expect(element).toBeNull();
        const original = HTMLMediaElement.prototype.play;
        const attempts: boolean[] = [];
        HTMLMediaElement.prototype.play = function play() {
            attempts.push((this as HTMLVideoElement).muted);
            return attempts.length === 1 ? Promise.reject(new Error('blocked')) : Promise.resolve();
        };
        try {
            await act(async () => {
                EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
                // The rejection handler is a microtask: let it run before asserting.
                await Promise.resolve();
                await Promise.resolve();
            });
        } finally {
            HTMLMediaElement.prototype.play = original;
        }
        expect(attempts).toEqual([false, true]);
    });

    it('freezes the scene and the music while it runs', () => {
        const heard: string[] = [];
        EventBus.on(MUSIC_PAUSE, () => heard.push('pause'));
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
        });
        expect(pause).toHaveBeenCalled();
        expect(heard).toContain('pause');
    });

    it('hands the scene and the music back when it ends', () => {
        const heard: string[] = [];
        EventBus.on(MUSIC_RESUME, () => heard.push('resume'));
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
        });
        const video = container.querySelector(
            '[data-testid="story-video-player"]',
        ) as HTMLVideoElement;
        act(() => {
            video.dispatchEvent(new Event('ended'));
        });
        expect(resume).toHaveBeenCalled();
        expect(heard).toContain('resume');
        expect(container.querySelector('[data-testid="story-video"]')).toBeNull();
    });

    it('reports DONE when it ends naturally', () => {
        const done: unknown[] = [];
        EventBus.on(STORY_VIDEO_DONE_EVENT, (payload?: unknown) => done.push(payload));
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
        });
        const video = container.querySelector(
            '[data-testid="story-video-player"]',
        ) as HTMLVideoElement;
        act(() => {
            video.dispatchEvent(new Event('ended'));
        });
        expect(done).toEqual([{ skipped: false }]);
    });

    it('reports DONE on a skip too, so the ending is not swallowed', () => {
        const done: unknown[] = [];
        EventBus.on(STORY_VIDEO_DONE_EVENT, (payload?: unknown) => done.push(payload));
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
        });
        act(() => {
            (
                container.querySelector('[data-testid="story-video-skip"]') as HTMLButtonElement
            ).click();
        });
        expect(done).toEqual([{ skipped: true }]);
        expect(resume).toHaveBeenCalled();
        expect(container.querySelector('[data-testid="story-video"]')).toBeNull();
    });

    it('only reports once, even if the tap and the ended event both land', () => {
        const done: unknown[] = [];
        EventBus.on(STORY_VIDEO_DONE_EVENT, (payload?: unknown) => done.push(payload));
        act(() => {
            EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
        });
        const video = container.querySelector(
            '[data-testid="story-video-player"]',
        ) as HTMLVideoElement;
        act(() => {
            video.dispatchEvent(new Event('ended'));
            (
                container.querySelector('[data-testid="story-video-skip"]') as HTMLButtonElement
            )?.click();
        });
        expect(done).toHaveLength(1);
    });
});
