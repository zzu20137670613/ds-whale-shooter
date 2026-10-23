/**
 * src/components/hud/comic-overlay.tsx
 * --------------------------------------------------------------------------
 * The 34-page comic, full screen over a black backdrop.
 *
 * Click / tap / Space / → advances immediately; a page left alone advances
 * itself after five seconds, and the timer restarts on every manual advance.
 * 跳过 skips the rest — needed for replays, and kept small and out of the way so
 * it never competes with the art.
 *
 * The clock is a `requestAnimationFrame` loop that feeds `tickComic`; all the
 * decisions live in `@/lib/story/comic` and are tested there.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
    advanceComic,
    comicPages,
    createComicState,
    nextPageToPreload,
    tickComic,
} from '@/lib/story/comic';
import { useGameStore } from '@/store/game-store';

/** Pages in the warhammer comic. Every level with an `introComic` block uses this. */
const PAGE_COUNT = 34;

export function ComicOverlay() {
    const levelId = useGameStore((s) => s.comicIntroLevelId);
    const close = useGameStore((s) => s.closeComicIntro);
    const [state, setState] = useState(() => createComicState());
    const [ready, setReady] = useState(false);
    const last = useRef<number | null>(null);

    // A new comic starts from page one, even if this component stayed mounted.
    useEffect(() => {
        if (!levelId) return;
        setState(createComicState());
        setReady(false);
    }, [levelId]);

    const step = useCallback(() => {
        setState((prev) => {
            const next = advanceComic(prev, PAGE_COUNT);
            if (next.finished) close();
            return next;
        });
    }, [close]);

    // rAF clock: only runs while a comic is up.
    useEffect(() => {
        if (!levelId) return;
        let raf = 0;
        const loop = (now: number) => {
            if (last.current !== null) {
                const delta = now - last.current;
                setState((prev) => {
                    const next = tickComic(prev, delta, PAGE_COUNT);
                    if (next.finished) close();
                    return next === prev ? prev : next;
                });
            }
            last.current = now;
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            last.current = null;
        };
    }, [levelId, close]);

    // Keyboard: the reader is a reader, so paging keys work.
    useEffect(() => {
        if (!levelId) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close();
                return;
            }
            if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
                e.preventDefault();
                step();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [levelId, step, close]);

    if (!levelId) return null;

    const pages = comicPages(levelId, PAGE_COUNT);
    const current = pages[Math.min(state.index, pages.length - 1)];
    const ahead = nextPageToPreload(state, levelId, PAGE_COUNT);

    return (
        <div
            data-testid="comic-overlay"
            className="absolute inset-0 z-[10000] flex items-center justify-center bg-black"
            onClick={step}
            role="button"
            tabIndex={-1}
        >
            {/* Preload the next page while this one is being read. */}
            {ahead && <img src={ahead} alt="" className="hidden" aria-hidden />}

            <img
                key={current.src}
                src={current.src}
                alt={`第 ${current.page} 页`}
                onLoad={() => setReady(true)}
                className={`max-h-full max-w-full object-contain transition-opacity duration-500 ${
                    ready ? 'opacity-100' : 'opacity-0'
                }`}
                draggable={false}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-4">
                <span className="font-mono text-[11px] tracking-[0.3em] text-white/40">
                    {current.page} / {pages.length}
                </span>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    close();
                }}
                className="absolute right-5 top-5 rounded-sm border border-white/25 px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-white/55 transition-colors hover:border-white/60 hover:text-white"
            >
                跳过
            </button>
        </div>
    );
}
