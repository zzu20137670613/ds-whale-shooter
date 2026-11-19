/**
 * tests/lib/game-loop-guard.test.ts
 * 主循环兜底：一帧抛异常不能把整局冻死（Phaser 的 RAF 链只在回调跑完后才预约下一帧）。
 */

import { describe, expect, it, vi } from 'vitest';

import { installLoopGuard, LOOP_CRASH_REPEAT_MS } from '@/lib/game-loop-guard';

interface FakeRaf {
    callback?: (time: number) => void;
    start: (cb: (time: number) => void) => void;
}

function fakeGame(): { game: { loop: { raf: FakeRaf } }; raf: FakeRaf } {
    const raf: FakeRaf = {
        callback: () => {
            /* replaced by the test */
        },
        start(cb) {
            this.callback = cb;
        },
    };
    return { game: { loop: { raf } }, raf };
}

describe('installLoopGuard', () => {
    it('swallows a throwing frame instead of letting it kill the loop', () => {
        const { game, raf } = fakeGame();
        raf.callback = () => {
            throw new Error('drop spawned badly');
        };
        installLoopGuard(game);

        expect(() => raf.callback!(16)).not.toThrow();
        // The frame after it still runs: that is the whole point.
        expect(() => raf.callback!(32)).not.toThrow();
    });

    it('reports the crash with its message and context', () => {
        const { game, raf } = fakeGame();
        raf.callback = () => {
            throw new Error('Phaser is not defined');
        };
        const onCrash = vi.fn();
        installLoopGuard(game, onCrash);

        raf.callback!(16);

        expect(onCrash).toHaveBeenCalledTimes(1);
        expect(onCrash.mock.calls[0][0]).toMatchObject({
            message: 'Phaser is not defined',
            context: 'game:loop',
        });
    });

    it('keeps passing the frame time through to a healthy callback', () => {
        const { game, raf } = fakeGame();
        const seen: number[] = [];
        raf.callback = (time) => seen.push(time);
        installLoopGuard(game);

        raf.callback!(10);
        raf.callback!(20);

        expect(seen).toEqual([10, 20]);
    });

    it('guards callbacks bound by a later start() (pause / resume re-binds)', () => {
        const { game, raf } = fakeGame();
        installLoopGuard(game);

        const rebound = () => {
            throw new Error('after resume');
        };
        raf.start(rebound);

        expect(() => raf.callback!(16)).not.toThrow();
    });

    it('throttles repeats of the same message', () => {
        const { game, raf } = fakeGame();
        raf.callback = () => {
            throw new Error('same every frame');
        };
        const onCrash = vi.fn();
        installLoopGuard(game, onCrash);

        const now = Date.now();
        const spy = vi.spyOn(Date, 'now');
        spy.mockReturnValue(now);
        raf.callback!(16);
        raf.callback!(32);
        raf.callback!(48);
        expect(onCrash).toHaveBeenCalledTimes(1);

        // After the window it reports again, so a persistent fault is not forgotten.
        spy.mockReturnValue(now + LOOP_CRASH_REPEAT_MS + 1);
        raf.callback!(64);
        expect(onCrash).toHaveBeenCalledTimes(2);
        spy.mockRestore();
    });

    it('survives a report handler that throws', () => {
        const { game, raf } = fakeGame();
        raf.callback = () => {
            throw new Error('boom');
        };
        installLoopGuard(game, () => {
            throw new Error('the banner broke too');
        });

        expect(() => raf.callback!(16)).not.toThrow();
    });

    it('does nothing when the game has no RAF loop yet', () => {
        expect(() => installLoopGuard(null)).not.toThrow();
        expect(() => installLoopGuard({})).not.toThrow();
    });

    it('uninstall restores the original callback', () => {
        const { game, raf } = fakeGame();
        const original = () => {
            throw new Error('original');
        };
        raf.callback = original;
        const uninstall = installLoopGuard(game);

        uninstall();

        expect(raf.callback).toBe(original);
    });
});