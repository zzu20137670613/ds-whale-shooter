/**
 * src/components/hud/fullscreen-toggle.tsx
 * --------------------------------------------------------------------------
 * The corner chip that goes fullscreen and comes back.
 *
 * The owner: `在游戏里【键盘操作】按钮与git图标之间加一个按钮，【全屏】，点击后变为【窗口】，
 * 控制游戏是否全屏`.
 *
 * Sits in the same row as the aim scheme and the gear, and styled like them so the cluster
 * reads as one control strip. The label names the ACTION (`全屏` while windowed, `窗口` while
 * fullscreen) rather than a state, which is what the owner asked for.
 *
 * The state comes from the document, not from local React state: the player can also leave
 * fullscreen with Esc or with Electron's F11, and the chip has to follow either way.
 *
 * The mobile build does not draw it at all: `移动端也不需要【全屏】按钮，不需要窗口化，移动端打开
 * 直接【全屏】，不给窗户化`. There, fullscreen is native and always on - `MainActivity` hides the
 * status and navigation bars on create - so a windowed mode would be a lie.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import { isMobileLike } from '@/lib/mobile';
import { isFullscreenNow, nextFullscreenAction } from '@/lib/ui/fullscreen';
import { t } from '@/locales';

/** Chromium fires `fullscreenchange`; older WebKit fires the prefixed one. */
const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

export const FullscreenToggle: React.FC = () => {
    const [fullscreen, setFullscreen] = useState(() =>
        typeof document === 'undefined' ? false : isFullscreenNow(document),
    );

    useEffect(() => {
        const sync = () => setFullscreen(isFullscreenNow(document));
        for (const event of FULLSCREEN_EVENTS) document.addEventListener(event, sync);
        return () => {
            for (const event of FULLSCREEN_EVENTS) document.removeEventListener(event, sync);
        };
    }, []);

    const toggle = useCallback(() => {
        // Fire and forget: the `fullscreenchange` listener is what updates the chip, so a
        // rejected request (a browser that wants a stronger user gesture) simply leaves the
        // label alone instead of flipping to a state that is not true.
        const action = nextFullscreenAction(isFullscreenNow(document));
        if (action === 'exit') {
            void document.exitFullscreen?.();
            return;
        }
        void document.documentElement.requestFullscreen?.();
    }, []);

    // Literal `t()` calls on purpose: the locale coverage test only sees keys referenced
    // directly, and an indirect `t(key)` makes both words look unused.
    const label = fullscreen ? t('hud.windowed') : t('hud.fullscreen');

    // No windowed mode on a phone: the native immersive flags own this.
    if (isMobileLike()) return null;
    const Icon = fullscreen ? Minimize2 : Maximize2;

    return (
        <div className="pointer-events-auto flex gap-1 rounded-md border border-white/20 bg-black/35 px-1 py-1 backdrop-blur-sm">
            <button
                type="button"
                onClick={toggle}
                data-testid="fullscreen-toggle"
                title={label}
                aria-label={label}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] leading-none text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
                <Icon size={12} strokeWidth={2} />
                <span>{label}</span>
            </button>
        </div>
    );
};