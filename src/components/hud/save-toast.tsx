/**
 * src/components/hud/save-toast.tsx
 * --------------------------------------------------------------------------
 * One short line near the bottom of the screen, for save / load / import feedback.
 *
 * Deliberately the smallest thing that can carry a sentence: the game has no toast
 * system, and a save that gives no feedback is indistinguishable from a save that
 * silently failed.
 */

import { useEffect, useState } from 'react';

import { SAVE_TOAST_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';

interface ToastPayload {
    message?: string;
    ms?: number;
}

export function SaveToast() {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onToast = (payload?: ToastPayload) => {
            if (!payload?.message) {
                setMessage(null);
                return;
            }
            setMessage(payload.message);
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => setMessage(null), payload.ms ?? 2000);
        };

        EventBus.on(SAVE_TOAST_EVENT, onToast);
        return () => {
            EventBus.removeListener(SAVE_TOAST_EVENT, onToast);
            if (timer) clearTimeout(timer);
        };
    }, []);

    if (!message) return null;

    return (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded border border-amber-700/60 bg-black/75 px-3 py-1 text-[11px] tracking-widest text-amber-300 uppercase">
            {message}
        </div>
    );
}