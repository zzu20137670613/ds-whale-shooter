/**
 * tests/lib/story/comic.test.ts
 * --------------------------------------------------------------------------
 * The reader's two rules, which are the only things a player will ever notice:
 * clicking advances, and a page left alone advances itself after five seconds —
 * with the timer starting over every time they click.
 */

import { describe, expect, it } from 'vitest';

import {
    COMIC_AUTO_ADVANCE_MS,
    advanceComic,
    comicPageSrc,
    comicPages,
    createComicState,
    nextPageToPreload,
    tickComic,
} from '@/lib/story/comic';

const COUNT = 34;

describe('comic reader', () => {
    it('numbers pages from 01 and names them after the level', () => {
        expect(comicPageSrc('warhammer-redeem', 1)).toBe(
            'assets/image/comic/warhammer-redeem-01.jpg',
        );
        expect(comicPageSrc('warhammer-redeem', 34)).toBe(
            'assets/image/comic/warhammer-redeem-34.jpg',
        );
        expect(comicPages('warhammer-redeem', COUNT)).toHaveLength(COUNT);
        expect(comicPages('warhammer-redeem', COUNT)[33].page).toBe(34);
    });

    it('opens on the first page', () => {
        const s = createComicState();
        expect(s.index).toBe(0);
        expect(s.finished).toBe(false);
    });

    it('advances one page per click', () => {
        let s = createComicState();
        s = advanceComic(s, COUNT);
        expect(s.index).toBe(1);
        s = advanceComic(s, COUNT);
        expect(s.index).toBe(2);
    });

    it('advances itself after five seconds of no clicking', () => {
        let s = createComicState();
        s = tickComic(s, COMIC_AUTO_ADVANCE_MS - 100, COUNT);
        expect(s.index).toBe(0);
        s = tickComic(s, 200, COUNT);
        expect(s.index).toBe(1);
    });

    it('restarts the five-second clock on a manual click', () => {
        // The annoying bug this prevents: click at 4.9 s, get yanked at 5.0 s.
        let s = createComicState();
        s = tickComic(s, 4900, COUNT);
        s = advanceComic(s, COUNT);
        expect(s.sinceAdvanceMs).toBe(0);
        s = tickComic(s, 200, COUNT);
        expect(s.index).toBe(1);
    });

    it('finishes after the last page instead of wrapping', () => {
        let s = createComicState();
        for (let i = 0; i < COUNT; i++) s = advanceComic(s, COUNT);
        expect(s.finished).toBe(true);
        expect(advanceComic(s, COUNT).finished).toBe(true);
        expect(tickComic(s, 60_000, COUNT).finished).toBe(true);
    });

    it('preloads the following page and nothing past the end', () => {
        const s = createComicState();
        expect(nextPageToPreload(s, 'warhammer-redeem', COUNT)).toBe(
            'assets/image/comic/warhammer-redeem-02.jpg',
        );
        let last = createComicState();
        for (let i = 0; i < COUNT - 1; i++) last = advanceComic(last, COUNT);
        expect(nextPageToPreload(last, 'warhammer-redeem', COUNT)).toBeNull();
    });
});
