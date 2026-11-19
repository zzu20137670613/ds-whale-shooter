/**
 * src/components/hud/debug-readout.tsx
 * --------------------------------------------------------------------------
 * A corner readout of whatever the game last published to `window.__<key>`.
 *
 * Only mounts when the URL asks for it (`?spriteDebug=1`, `?ammoDebug=1`), so it costs
 * nothing in a normal session. It exists because "the sprite twitches" is not
 * reproducible from code reading: you need to know whether the flip, the animation key,
 * or the frame index is the thing changing.
 */

import React from 'react';

interface DebugReadoutProps {
    /** Query-string flag that turns it on, e.g. `spriteDebug`. */
    flag: string;
    /** Global the game writes to, e.g. `__spriteDebug`. */
    globalKey: string;
    /** Corner to occupy. */
    corner?: 'top-left' | 'top-right' | 'bottom-left';
}

export const DebugReadout: React.FC<DebugReadoutProps> = ({
    flag,
    globalKey,
    corner = 'top-left',
}) => {
    const enabled = typeof window !== 'undefined' && window.location.search.includes(flag);
    const [snap, setSnap] = React.useState<Record<string, unknown> | null>(null);

    React.useEffect(() => {
        if (!enabled) return;
        const id = window.setInterval(() => {
            const live = (window as unknown as Record<string, unknown>)[globalKey];
            if (live && typeof live === 'object') setSnap({ ...(live as Record<string, unknown>) });
        }, 150);
        return () => window.clearInterval(id);
    }, [enabled, globalKey]);

    if (!enabled || !snap) return null;
    const position =
        corner === 'top-right'
            ? 'top-24 right-3'
            : corner === 'bottom-left'
              ? 'bottom-24 left-3'
              : 'top-24 left-3';
    return (
        <div
            className={`pointer-events-none absolute ${position} z-40 border border-lime-600 bg-black/85 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300`}
            data-testid="debug-readout"
        >
            {Object.entries(snap).map(([k, v]) => (
                <div key={k}>
                    {k}={String(v)}
                </div>
            ))}
        </div>
    );
};