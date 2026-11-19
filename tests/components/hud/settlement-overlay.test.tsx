// @vitest-environment happy-dom
/**
 * tests/components/hud/settlement-overlay.test.tsx
 * --------------------------------------------------------------------------
 * The ending's captions have to be readable over two very different plates.
 *
 * The owner: `最终boss战两张图片结束的时候图片上的字体小了且颜色淡了，字体颜色换成与鲸鱼娘本人
 * 游玩buff一样的字体颜色，并且放大两个字号`.
 *
 * They were 15 px at 85% white - legible on the dark upper third of the first plate, but the
 * walk-out plate is morning light, and text at 85% opacity disappears into it. The fix is the
 * same one the buff chip got: the chip's warm white (`text-orange-50`), two sizes up.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettlementOverlay } from '@/components/hud/settlement-overlay';
import { SETTLEMENT_PLATES } from '@/lib/story/settlement';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** The overlay drives its own clock with rAF; the test drives that frame by frame. */
let pending: FrameRequestCallback | null = null;
let clock = 0;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<SettlementOverlay />));
}

/** Advance the sequence by `frames` rAF ticks. */
function tick(frames: number) {
    for (let i = 0; i < frames; i++) {
        const cb = pending;
        if (!cb) return;
        act(() => {
            clock += 100;
            cb(clock);
        });
    }
}

/**
 * Run frames until `done()` says so.
 *
 * A tick does not advance the sequence by a full 100 ms (the overlay's own rAF loop shares the
 * frame with React's flush), so counting frames to reach "the second caption" is brittle.
 * Waiting for the condition is what these tests actually mean.
 */
function tickUntil(done: () => boolean, maxFrames = 600) {
    for (let i = 0; i < maxFrames && !done(); i++) tick(1);
}

beforeEach(() => {
    pending = null;
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        pending = cb;
        return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
        pending = null;
    });
    // Plate 0 is silent now (the owner moved all three lines onto plate 1 on
    // 2026-11-15), so a caption test has to tick into the walk-out plate.
    useGameStore.setState({ settlementOpen: true, settlementRunMs: 754_000 });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGameStore.setState({ settlementOpen: false });
    vi.unstubAllGlobals();
});

const captions = () => Array.from(document.querySelectorAll('[data-settlement-caption]'));

describe('the ending captions', () => {
    it('are two sizes bigger than the 15px they shipped at', () => {
        render();
        tickUntil(() => captions().length >= 1);
        const lines = captions();
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(line.className).toContain('text-[17px]');
            expect(line.className).not.toContain('text-[15px]');
        }
    });

    it('use the buff chip’s warm white instead of 85% white', () => {
        render();
        tickUntil(() => captions().length >= 1);
        for (const line of captions()) {
            expect(line.className).toContain('text-orange-50');
            expect(line.className).not.toContain('text-white/85');
        }
    });

    it('still fade in with a shadow, so they hold up on the bright plate', () => {
        render();
        tickUntil(() => captions().length >= 1);
        const first = captions()[0];
        expect(first.className).toContain('text-shadow');
        expect(first.className).toContain('fadeIn');
    });

    it('keep their words', () => {
        render();
        tickUntil(() => captions().length >= 2);
        const text = captions()
            .map((line) => line.textContent)
            .join(' ');
        expect(text).toContain('是爱');
        expect(text).toContain('白米饭');
    });

    it('are what the frame machine says should be on screen', () => {
        // Guard against a hardcoded list drifting from the plates: whatever is up must be a
        // prefix of the walk-out plate's three lines, in order.
        render();
        tickUntil(() => captions().length >= 2);
        const shown = captions().map((line) => line.textContent);
        const expected = SETTLEMENT_PLATES[0].captions.map((c) => c.text);
        expect(shown).toEqual(expected.slice(0, shown.length));
        expect(shown.length).toBeGreaterThanOrEqual(2);
    });

    it('starts the walk-out plate empty, then brings its lines in one by one', () => {
        // 两张图各带三句（2026-11-15 对调）：换图那一刻屏幕是空的，第一句要等 800 ms。
        render();
        tickUntil(
            () =>
                (document.querySelector('[data-testid="settlement-overlay"] img') as HTMLImageElement | null)
                    ?.getAttribute('src')
                    ?.includes('walkout') ?? false,
        );
        expect(captions()).toHaveLength(0);
    });
});