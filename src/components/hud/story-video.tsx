/**
 * src/components/hud/story-video.tsx
 * --------------------------------------------------------------------------
 * Full-screen cut-scene playback.
 *
 * The owner: `播放【一夜鱼龙舞】` at the sky-city throne, and `播放【牵手】` between the church
 * walkout plate and the 创作不易 dialog. His playback rules: `加「点击跳过」，带声音（播放时BGM
 * 取消，用视频原声）`.
 *
 * So this component owns three things and nothing else:
 *
 *   1. the `<video>` itself (audio on, its own soundtrack - no BGM underneath it),
 *   2. skipping (a button, and a tap anywhere on the picture),
 *   3. pausing the Phaser scene and the music while it runs, then handing both back.
 *
 * Callers only say "play this file": `EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src })`. Anything
 * that has to happen *after* the video listens for `STORY_VIDEO_DONE_EVENT` - that is how the
 * ending chains 牵手 → 创作不易 without either component knowing about the other.
 */

import type Phaser from 'phaser';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
    MUSIC_PAUSE,
    MUSIC_RESUME,
    PLAY_STORY_VIDEO_EVENT,
    STORY_VIDEO_DONE_EVENT,
} from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { getPhaserGame } from '@/lib/phaser-game';
import { recordCrash } from '@/lib/dev/crash-log';
import { t } from '@/locales';

export const StoryVideo: React.FC = () => {
    const [src, setSrc] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    /** The scene we paused, so a skip mid-video still hands it back. */
    const pausedScene = useRef<Phaser.Scene | null>(null);
    const finishedRef = useRef(false);

    /**
     * 关掉片子，把场景和音乐还回去。
     *
     * 主人 2026-11-16：`打boss通关之后的动画播放点击跳过没反应` —— 视频在动、按钮也在，
     * 就是关不掉。原因不是按钮，是**这个函数中途抛异常**：它先把 `finishedRef` 置真，再去
     * 恢复场景 / 发 MUSIC_RESUME / 发 DONE，其中任何一步抛出来（场景已经被切走、某个
     * 监听器出错），`setSrc(null)` 就再也不会执行了；而 `finishedRef` 已经是真，所以之后
     * 每一次点击都在第一行被挡回去 —— 表现正是「点跳过没有任何反应」。
     *
     * 所以顺序反过来了：**先把画面放掉**，再去动场景和事件，并且每一步各自兜底。
     * 跳过是玩家的逃生门，不能因为收尾出错而消失。
     */
    const stop = useCallback((skipped: boolean) => {
        if (finishedRef.current) return;
        finishedRef.current = true;

        const scene = pausedScene.current;
        pausedScene.current = null;
        // 1) 先把片子从屏幕上撤掉。这一句必须最先执行，且不可能失败。
        setSrc(null);

        // 2) 再还场景、还音乐、通知后面的人。三步互不影响。
        //
        // 注意这里先看 `sys`：片子在播的时候关卡可能已经被整个换掉（结局走完就换场景），
        // 那时 `scene.scene`（ScenePlugin）还挂在对象上、`sys` 已经是 null，
        // `resume()` 会抛 `Cannot read properties of null (reading 'queueOp')`。
        // 这不是 bug，是"已经没有场景需要恢复了"——所以静默跳过，不要惊动崩溃横幅。
        if (scene?.sys) {
            try {
                scene.scene.resume();
            } catch (error) {
                recordCrash(error, 'video:resume-scene');
            }
        }
        try {
            EventBus.emit(MUSIC_RESUME);
        } catch (error) {
            recordCrash(error, 'video:resume-music');
        }
        // DONE fires on both endings. Whoever waits on it is waiting for the picture to be out
        // of the way, not for the player's patience: a skip must not also swallow the next
        // beat of the ending.
        try {
            EventBus.emit(STORY_VIDEO_DONE_EVENT, { skipped });
        } catch (error) {
            recordCrash(error, 'video:done');
        }
    }, []);

    useEffect(() => {
        const onPlay = (payload?: { src?: string }) => {
            if (!payload?.src) return;
            finishedRef.current = false;
            pausedScene.current = getPhaserGame()?.scene.getScenes(true)[0] ?? null;
            // 同上：只有还活着的场景才值得暂停。
            if (pausedScene.current?.sys) pausedScene.current.scene.pause();
            EventBus.emit(MUSIC_PAUSE);
            setSrc(payload.src);
        };
        EventBus.on(PLAY_STORY_VIDEO_EVENT, onPlay);
        return () => EventBus.off(PLAY_STORY_VIDEO_EVENT, onPlay);
    }, []);

    // Esc 也能跳过。跳过是逃生门，多一条路不多。
    useEffect(() => {
        if (!src) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') stop(true);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [src, stop]);

    useEffect(() => {
        if (!src) return;
        // Autoplay is allowed because this runs inside the same gesture-driven session the
        // game already has; if the browser still refuses, the poster-less <video> shows its
        // own controls via the skip button, so the player is never trapped.
        const video = videoRef.current;
        if (!video) return;
        // Browsers refuse unmuted autoplay without a gesture, and neither cut-scene starts on a
        // tap (one is stepped on, the other follows the ending). Falling back to muted keeps
        // the picture moving - a frozen first frame with no explanation reads as a crash -
        // and the owner's 点击跳过 is still the way out.
        void video.play().catch(() => {
            video.muted = true;
            void video.play().catch(() => {
                /* still refused: 跳过 is the way out */
            });
        });
    }, [src]);

    if (!src) return null;

    return (
        <div
            data-testid="story-video"
            className="pointer-events-auto absolute inset-0 z-[10002] flex items-center justify-center bg-black"
            onClick={() => stop(false)}
        >
            <video
                ref={videoRef}
                data-testid="story-video-player"
                src={src}
                className="h-full w-full object-contain"
                playsInline
                // Not `muted`: the owner asked for the video's own audio while the BGM is off.
                onEnded={() => stop(false)}
                onError={() => stop(true)}
            />
            <button
                type="button"
                data-testid="story-video-skip"
                onClick={(e) => {
                    // Same hand-off as a natural end, just earlier.
                    e.stopPropagation();
                    stop(true);
                }}
                className="absolute right-4 bottom-4 border border-stone-500 bg-stone-950/80 px-3 py-1.5 font-['Silkscreen',monospace] text-[13px] text-stone-100 hover:border-stone-300"
            >
                {t('video.skip')}
            </button>
        </div>
    );
};
