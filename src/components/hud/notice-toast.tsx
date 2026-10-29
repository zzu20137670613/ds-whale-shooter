/**
 * src/components/hud/notice-toast.tsx
 * --------------------------------------------------------------------------
 * One short line from the game, near the top of the screen.
 *
 * Exists because the cabin cat silently handing over a rifle is indistinguishable from the
 * cat doing nothing - which is exactly how that bug survived three reports. Anything the
 * game does *to* the player unasked should say so.
 */

import React from 'react';

import { useGameStore } from '@/store/game-store';

/** How long a notice stays up, in ms. */
export const NOTICE_MS = 2800;

/** The visual. Separated so it can be rendered without a store (and tested). */
export const NoticeView: React.FC<{ text: string | null }> = ({ text }) => {
    if (!text) return null;
    return (
        <div
            className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center"
            data-testid="notice-toast"
        >
            <div className="border-2 border-amber-500/80 bg-stone-950/90 px-3 py-1.5 font-['Silkscreen',monospace] text-[12px] leading-none tracking-wide text-amber-200 shadow-[0_4px_16px_rgba(0,0,0,0.55)]">
                {text}
            </div>
        </div>
    );
};

export const NoticeToast: React.FC = () => {
    const notice = useGameStore((s) => s.notice);
    const noticeId = useGameStore((s) => s.noticeId);
    const clearNotice = useGameStore((s) => s.clearNotice);

    React.useEffect(() => {
        if (!notice) return;
        const id = window.setTimeout(() => clearNotice(), NOTICE_MS);
        return () => window.clearTimeout(id);
        // `noticeId` in the deps restarts the timer when the same text is shown again.
    }, [notice, noticeId, clearNotice]);

    return <NoticeView text={notice} />;
};
