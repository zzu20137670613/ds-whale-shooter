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
import { RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import { formatRunTime, settlementAt, settlementDuration } from '@/lib/story/settlement';
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

    // Clock. Resets whenever the sequence opens.
    useEffect(() => {
        if (!open) {
            setElapsed(0);
            last.current = null;
            return;
        }
        let raf = 0;
        const loop = (now: number) => {
            if (last.current === null) last.current = now;
            setElapsed((prev) => prev + (now - last.current!));
            last.current = now;
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            last.current = null;
        };
    }, [open]);

    // When it ends: put the player back as themselves and walk them home.
    useEffect(() => {
        if (!open || elapsed < settlementDuration()) return;
        if (before) setCharacter(before);
        setBefore(null);
        close();
        EventBus.emit(RETURN_TO_PAVILION_EVENT);
    }, [open, elapsed, before, setCharacter, setBefore, close]);

    if (!open) return null;

    const frame = settlementAt(elapsed);
    const plate = frame.plate < 3 ? frame.plate : 2;
    const isLedger = plate === 2;
    const image = isLedger
        ? null
        : frame.plate === 0
          ? 'assets/image/scenes/warhammer-first-meeting.png'
          : 'assets/image/scenes/warhammer-ending-walkout.jpg';

    return (
        <div
            data-testid="settlement-overlay"
            className="absolute inset-0 z-[10001] overflow-hidden bg-black"
            onClick={() => setElapsed(settlementDuration())}
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
                        className="animate-[fadeIn_900ms_ease-out] font-mono text-[15px] tracking-[0.18em] text-white/85 [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]"
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
