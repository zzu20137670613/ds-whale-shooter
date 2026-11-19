/**
 * src/components/hud/settlement-overlay.tsx
 * --------------------------------------------------------------------------
 * The ending. Three beats, no score, no rank:
 *
 *   1. the retouched first-meeting plate, slow push-in, two lines
 *   2. the walk-out plate (the two of them leaving the church into morning)
 *   3. a black ledger with the run time and nothing else
 *
 * then back to the seaside pavilion as whoever the player was before the arena
 * forced 鲸鲸 on them.
 *
 * The timing lives in `@/lib/story/settlement` (`settlementAt`) and is tested
 * there, so this file only paints what it is told.
 */

import { useEffect, useRef, useState } from 'react';

import { EventBus } from '@/lib/events/bus';
import { PLAY_STORY_VIDEO_EVENT, STORY_VIDEO_DONE_EVENT } from '@/lib/constants';
import { SUPPORT_OPEN_EVENT } from '@/lib/story/settlement';
import {
    SETTLEMENT_PLATES,
    formatRunTime,
    settlementAt,
    settlementDuration,
    settlementPlateEnd,
    settlementTapElapsed,
} from '@/lib/story/settlement';
import { useGameStore } from '@/store/game-store';

export function SettlementOverlay() {
    const open = useGameStore((s) => s.settlementOpen);
    const runMs = useGameStore((s) => s.settlementRunMs);
    const close = useGameStore((s) => s.closeSettlement);
    const before = useGameStore((s) => s.characterBeforeArena);
    const setCharacter = useGameStore((s) => s.setSelectedCharacterId);
    const setBefore = useGameStore((s) => s.setCharacterBeforeArena);
    const [elapsed, setElapsed] = useState(0);
    const last = useRef<number | null>(null);
    /**
     * True while 牵手 is on screen.
     *
     * The owner put the clip `在…牵手走出教堂的那张图之后，弹创造不易那个弹框之前`: between plate
     * 2 and the ledger. The clock therefore stops at the end of the walk-out plate, the video
     * plays, and the ledger resumes only when the video is over (or skipped).
     */
    const frozen = useRef(false);
    const clipPlayed = useRef(false);

    // Clock. Resets whenever the sequence opens.
    useEffect(() => {
        if (!open) {
            setElapsed(0);
            last.current = null;
            frozen.current = false;
            clipPlayed.current = false;
            return;
        }
        let raf = 0;
        const loop = (now: number) => {
            if (last.current === null) last.current = now;
            // A frozen clock keeps its hand still: the frames that pass while the video runs
            // must not silently eat the next plate.
            if (!frozen.current) setElapsed((prev) => prev + (now - last.current!));
            last.current = now;
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            last.current = null;
        };
    }, [open]);

    // The hand-off: 牵手 plays the moment the walk-out plate ends.
    useEffect(() => {
        if (!open) return;
        const walkOutEnd = settlementPlateEnd(1, SETTLEMENT_PLATES);
        if (clipPlayed.current || elapsed < walkOutEnd) return;
        clipPlayed.current = true;
        frozen.current = true;
        EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: 'assets/video/holding-hands.mp4' });
    }, [open, elapsed]);

    // ...and the ledger waits for it. DONE arrives on both "finished" and "skipped", so a
    // player who taps 跳过 still gets the rest of the ending.
    useEffect(() => {
        const onDone = () => {
            frozen.current = false;
        };
        EventBus.on(STORY_VIDEO_DONE_EVENT, onDone);
        return () => EventBus.off(STORY_VIDEO_DONE_EVENT, onDone);
    }, []);

    // When it ends: put the player back as themselves and walk them home.
    useEffect(() => {
        if (!open || elapsed < settlementDuration()) return;
        if (before) setCharacter(before);
        setBefore(null);
        close();
        // Not straight home: the support placeholder sits between the church and the
        // pavilion, and ITS buttons do the walking.
        EventBus.emit(SUPPORT_OPEN_EVENT);
    }, [open, elapsed, before, setCharacter, setBefore, close]);

    if (!open) return null;

    const frame = settlementAt(elapsed);
    const plate = frame.plate < 3 ? frame.plate : 2;
    const isLedger = plate === 2;
    const image = isLedger
        ? null
        : frame.plate === 0
          ? 'assets/image/scenes/warhammer-redeem/warhammer-first-meeting.png'
          : 'assets/image/scenes/warhammer-redeem/warhammer-ending-walkout.jpg';

    return (
        <div
            data-testid="settlement-overlay"
            className="absolute inset-0 z-[10001] overflow-hidden bg-black"
            onClick={() => {
                // Never past the clip: a stray tap has to start 牵手, not jump the whole ending
                // (and the support panel) over it. See `settlementTapElapsed`.
                const next = settlementTapElapsed(clipPlayed.current, frozen.current);
                if (next !== null) setElapsed(next);
            }}
        >
            {image && (
                <img
                    src={image}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{
                        transform: `scale(${frame.scale})`,
                        transition: 'transform 120ms linear',
                    }}
                    draggable={false}
                />
            )}

            {/* Captions live in the dark upper third of both plates. */}
            <div className="pointer-events-none absolute inset-x-0 top-[16%] flex flex-col items-center gap-6 px-10">
                {frame.captions.map((line) => (
                    <p
                        key={line}
                        data-settlement-caption
                        // The walk-out plate is morning light, so 15 px at 85% white sank into
                        // it. Same warm white as the pet-buff chip, two sizes up: the chip is
                        // the one piece of HUD text the owner singled out as easy to read.
                        className="animate-[fadeIn_900ms_ease-out] font-mono text-[17px] tracking-[0.18em] text-orange-50 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]"
                    >
                        {line}
                    </p>
                ))}
            </div>

            {isLedger && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <p className="font-mono text-[11px] tracking-[0.4em] text-white/35">用时</p>
                    <p className="font-mono text-[34px] tracking-[0.2em] text-white/70">
                        {formatRunTime(runMs)}
                    </p>
                </div>
            )}
        </div>
    );
}
