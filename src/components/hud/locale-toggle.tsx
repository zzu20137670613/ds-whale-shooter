/**
 * src/components/hud/locale-toggle.tsx
 * --------------------------------------------------------------------------
 * A one-tap language switch (中文 ⇄ EN), pinned to the top-right corner
 * just under the wallet chip.
 *
 * It flips `useGameStore.locale`, which mirrors into the i18n runtime —
 * so every `t()` catalog lookup and every `pickText()` data lookup follows.
 * Keeping the control in the React layer (rather than a Phaser key) means
 * the switch works on the title screen, in the tavern and mid-level alike.
 *
 * The label shows the CURRENT language, not the target, so it reads as a
 * status ("you are in 中文") as well as a button. Those two CJK glyphs are
 * the first test of the Zpix fallback declared in `styles/fonts.css`.
 */
import { Languages } from 'lucide-react';

import { useGameStore } from '@/store/game-store';

export function LocaleToggle() {
    const locale = useGameStore((s) => s.locale);
    const setLocale = useGameStore((s) => s.setLocale);
    const hubsVisible = useGameStore((s) => s.hubsVisible);

    if (!hubsVisible) return null;

    const isChinese = locale === 'zh-CN';

    return (
        <button
            type="button"
            data-testid="locale-toggle"
            aria-label={isChinese ? 'Switch to English' : '切换到中文'}
            onClick={() => setLocale(isChinese ? 'en' : 'zh-CN')}
            className="absolute top-4 right-4 z-20 flex items-center gap-1 border-2 border-amber-900/80 bg-stone-900/85 px-2 py-1 font-['Silkscreen',monospace] text-[10px] font-bold leading-none text-amber-300 pointer-events-auto select-none hover:text-amber-200"
        >
            <Languages className="size-3 text-amber-400" />
            {isChinese ? '中文' : 'EN'}
        </button>
    );
}