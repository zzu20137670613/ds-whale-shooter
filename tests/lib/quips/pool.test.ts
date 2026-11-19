/**
 * tests/lib/quips/pool.test.ts
 * --------------------------------------------------------------------------
 * 台词抽取：**洗牌 + 记忆窗口**（主人 2026-11-18 明确不要抽卡稀有度那套）。
 *
 * 两条规则各自都要成立，而且不能互相踩：
 *   · 一轮之内不重复；
 *   · 最近 5 句不会再被抽到 —— 包括"刚洗完牌、某句恰好排在最前面"的情况。
 */

import { describe, expect, it } from 'vitest';

import {
    QUIP_DELAY_MAX_MS,
    QUIP_DELAY_MIN_MS,
    QUIP_MEMORY_WINDOW,
    emptyQuipState,
    nextQuip,
    nextQuipDelayMs,
    type Quip,
    type QuipState,
} from '@/lib/quips/pool';

const pool = (n: number): Quip[] =>
    Array.from({ length: n }, (_, i) => ({ id: `q${i}`, group: 'meta', text: `第 ${i} 句` }));

/** 固定的"随机"，让洗牌结果可预期。 */
const fixedRandom = (value = 0.42) => () => value;

/** 连续抽 n 次，返回抽到的 id 序列与最终状态。 */
function drawN(p: readonly Quip[], state: QuipState, n: number, random = Math.random) {
    const ids: string[] = [];
    let cur = state;
    for (let i = 0; i < n; i += 1) {
        const { quip, state: next } = nextQuip(p, cur, random);
        if (quip) ids.push(quip.id);
        cur = next;
    }
    return { ids, state: cur };
}

describe('nextQuip', () => {
    it('runs through the whole pool before repeating anything', () => {
        const p = pool(8);
        const { ids } = drawN(p, emptyQuipState(), 8);
        expect(new Set(ids).size).toBe(8);
    });

    it('refills and keeps going after a full round', () => {
        const p = pool(8);
        const { ids } = drawN(p, emptyQuipState(), 24);
        expect(ids).toHaveLength(24);
        // 每 8 句一轮，轮内不重复。
        for (let round = 0; round < 3; round += 1) {
            const slice = ids.slice(round * 8, round * 8 + 8);
            expect(new Set(slice).size).toBe(8);
        }
    });

    it('never repeats one of the last five, even right after a reshuffle', () => {
        // 池子比窗口大，所以"最近 5 句"必须被完全排开 —— 包括洗牌后的第一句。
        const p = pool(10);
        const { ids } = drawN(p, emptyQuipState(), 40, fixedRandom(0));
        for (let i = QUIP_MEMORY_WINDOW; i < ids.length; i += 1) {
            const windowIds = ids.slice(i - QUIP_MEMORY_WINDOW, i);
            expect(windowIds).not.toContain(ids[i]);
        }
    });

    it('still speaks when the pool is smaller than the window', () => {
        // 3 句台词、窗口 5：不能把嘴堵死，只能退让。
        const p = pool(3);
        const { ids } = drawN(p, emptyQuipState(), 9);
        expect(ids).toHaveLength(9);
        expect(new Set(ids).size).toBe(3);
    });

    it('is stable on an empty pool', () => {
        const { quip, state } = nextQuip([], emptyQuipState());
        expect(quip).toBeNull();
        expect(state.remaining).toEqual([]);
    });

    it('drops ids that no longer exist in the pool', () => {
        // 台词被删掉之后，存档里那条 remaining 不该让整轮卡住。
        const stale: QuipState = { remaining: ['gone', 'q1'], recent: [] };
        const { quip } = nextQuip(pool(4), stale, fixedRandom(0));
        expect(quip?.id).toBe('q1');
    });
});

describe('nextQuipDelayMs', () => {
    it('stays inside 60-90 seconds', () => {
        for (const v of [0, 0.25, 0.5, 0.75, 1]) {
            const ms = nextQuipDelayMs(() => v);
            expect(ms).toBeGreaterThanOrEqual(QUIP_DELAY_MIN_MS);
            expect(ms).toBeLessThanOrEqual(QUIP_DELAY_MAX_MS);
        }
    });

    it('jitters rather than firing on a metronome', () => {
        expect(nextQuipDelayMs(() => 0)).not.toBe(nextQuipDelayMs(() => 1));
    });

    it('clamps junk input', () => {
        expect(nextQuipDelayMs(() => -1)).toBe(QUIP_DELAY_MIN_MS);
        expect(nextQuipDelayMs(() => 2)).toBe(QUIP_DELAY_MAX_MS);
    });
});