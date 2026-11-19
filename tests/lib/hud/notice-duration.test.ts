/**
 * tests/lib/hud/notice-duration.test.ts
 * --------------------------------------------------------------------------
 * 一条提示停留多久：短提示保持 2.8 秒，长句顺延，但不封顶就没人受得了。
 *
 * 2026-11-18 起所有角色台词都进这个框（主人：`一起收`），而那时台词里已经有 54 字的长句
 * （带 gitee 仓库名那几句）。固定 2.8 秒等于"刚看清开头就没了"。
 */

import { describe, expect, it } from 'vitest';

import {
    NOTICE_BASE_MS,
    NOTICE_FREE_CHARS,
    NOTICE_MAX_MS,
    NOTICE_MS_PER_CHAR,
    noticeMsFor,
} from '@/lib/hud/notice-duration';

describe('noticeMsFor', () => {
    it('keeps the old 2.8s for short notices', () => {
        // 「血上限 +100」那种长度不该变慢，不然会挡住别的提示。
        expect(noticeMsFor('血上限 +100')).toBe(NOTICE_BASE_MS);
        expect(noticeMsFor('x'.repeat(NOTICE_FREE_CHARS))).toBe(NOTICE_BASE_MS);
    });

    it('gives longer lines more time', () => {
        const short = noticeMsFor('短');
        const long = noticeMsFor('礁石上有杯深海特饮……是谁放在这儿的？');
        expect(long).toBeGreaterThan(short);
    });

    it('scales linearly past the free prefix', () => {
        const a = noticeMsFor('x'.repeat(20));
        const b = noticeMsFor('x'.repeat(21));
        expect(b - a).toBe(NOTICE_MS_PER_CHAR);
    });

    it('caps so a long line cannot hog the screen', () => {
        expect(noticeMsFor('x'.repeat(200))).toBe(NOTICE_MAX_MS);
    });

    it('counts Chinese characters as one, not by UTF-16 units', () => {
        // 用 [...text] 数，emoji 之类不会被算成两个字。
        expect(noticeMsFor('🐳')).toBe(NOTICE_BASE_MS);
    });

    it('falls back to the base time for nothing', () => {
        expect(noticeMsFor(null)).toBe(NOTICE_BASE_MS);
        expect(noticeMsFor('')).toBe(NOTICE_BASE_MS);
    });
});