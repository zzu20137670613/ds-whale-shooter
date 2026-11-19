/**
 * src/lib/story/comic.ts
 * --------------------------------------------------------------------------
 * The 34-page comic that opens the hidden level, as a pure state machine.
 *
 * The player advances by clicking, and a page they leave alone advances itself
 * after five seconds — so the reader works whether they are reading or just
 * letting it run. Manual advance **resets** the timer: nothing is worse than
 * clicking and being yanked forward a moment later.
 *
 * Deliberately no React, no timers, no DOM: `tick()` takes the elapsed
 * milliseconds and returns the next state, so the whole ceremony is a table of
 * assertions instead of a stopwatch.
 */

/** How long a page waits before it advances itself. */
export const COMIC_AUTO_ADVANCE_MS = 5000;

export interface ComicPage {
    /** 1-based page number, as printed in the source. */
    page: number;
    /** Path relative to `public/`. */
    src: string;
}

export interface ComicState {
    /** 0-based index of the page on screen. */
    index: number;
    /** Milliseconds the current page has been up, for the auto-advance. */
    sinceAdvanceMs: number;
    /** True once the last page has been dismissed. */
    finished: boolean;
}

/** Page n of `level`'s comic, 1-based, as staged by the asset pipeline. */
export function comicPageSrc(level: string, page: number): string {
    return `assets/image/comic/${level}-${String(page).padStart(2, '0')}.jpg`;
}

/** The whole run, in order. */
export function comicPages(level: string, count: number): ComicPage[] {
    return Array.from({ length: count }, (_, i) => ({
        page: i + 1,
        src: comicPageSrc(level, i + 1),
    }));
}

export function createComicState(): ComicState {
    return { index: 0, sinceAdvanceMs: 0, finished: false };
}

/** Move one page on — by click, or by the timer. Wraps into `finished`. */
export function advanceComic(state: ComicState, count: number): ComicState {
    if (state.finished) return state;
    const next = state.index + 1;
    if (next >= count) return { ...state, index: count, sinceAdvanceMs: 0, finished: true };
    return { index: next, sinceAdvanceMs: 0, finished: false };
}

/**
 * Advance the clock. Returns the same object when nothing changes so React can
 * skip the re-render — this runs on every animation frame.
 */
export function tickComic(
    state: ComicState,
    deltaMs: number,
    count: number,
    autoMs: number = COMIC_AUTO_ADVANCE_MS,
): ComicState {
    if (state.finished) return state;
    const sinceAdvanceMs = state.sinceAdvanceMs + Math.max(0, deltaMs);
    if (sinceAdvanceMs < autoMs) return { ...state, sinceAdvanceMs };
    return advanceComic({ ...state, sinceAdvanceMs }, count);
}

/** Page the reader should have loaded and ready: the next one. */
export function nextPageToPreload(state: ComicState, level: string, count: number): string | null {
    const next = state.index + 1;
    return next < count ? comicPageSrc(level, next + 1) : null;
}
