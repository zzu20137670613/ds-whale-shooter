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

import { NOTICE_FONT_PX } from '@/lib/constants';
import { NOTICE_BASE_MS, noticeMsFor } from '@/lib/hud/notice-duration';
import { useGameStore } from '@/store/game-store';

/** 最短停留时间，兜底用；实际按字数算，见 `noticeMsFor`。 */
export const NOTICE_MS = NOTICE_BASE_MS;

/** The visual. Separated so it can be rendered without a store (and tested). */
export const NoticeView: React.FC<{ text: string | null }> = ({ text }) => {
    if (!text) return null;
    return (
        <div
            className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center"
            data-testid="notice-toast"
        >
            <div
                // `max-w` + 居中：字号涨到 27px 之后，最长的那几句（王座彩蛋）在手机横向
                // 宽度上会顶到边，允许换行比让文字跑出屏幕好。
                className="max-w-[92vw] border-2 border-amber-500/80 bg-stone-950/90 px-4 py-2 text-center font-mono leading-relaxed text-amber-200 shadow-[0_4px_16px_rgba(0,0,0,0.55)]"
                style={{ fontSize: `${NOTICE_FONT_PX}px` }}
            >
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
        // 按字数给时间：2026-11-18 之后台词变长了（最长的安利台词 54 字），
        // 固定 2.8 秒会让长句还没读完就消失。
        const id = window.setTimeout(() => clearNotice(), noticeMsFor(notice));
        return () => window.clearTimeout(id);
        // `noticeId` in the deps restarts the timer when the same text is shown again.
    }, [notice, noticeId, clearNotice]);

    return <NoticeView text={notice} />;
};
