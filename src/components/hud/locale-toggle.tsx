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

import { TOP_CHIP_LEFT_PX, topChipTop } from '@/lib/hud/mobile-layout';
import { isMobileLike } from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

export function LocaleToggle() {
    const locale = useGameStore((s) => s.locale);
    const setLocale = useGameStore((s) => s.setLocale);
    const hubsVisible = useGameStore((s) => s.hubsVisible);

    if (!hubsVisible) return null;

    const isChinese = locale === 'zh-CN';
    // 手机端：血蓝卡片右边那一列（主人 2026-11-13）。
    // 桌面端：主人 2026-11-15 `将PC端右上角显示的中英文切换和钱币数量移到左上角` ——
    // 桌面的血蓝卡在左下角，所以左上角整块空着，两块小牌子就叠在这儿。
    const mobile = isMobileLike();

    return (
        <button
            type="button"
            data-testid="locale-toggle"
            aria-label={isChinese ? 'Switch to English' : '切换到中文'}
            onClick={() => setLocale(isChinese ? 'en' : 'zh-CN')}
            className="absolute top-4 left-4 z-20 flex items-center gap-1 border-2 border-amber-900/80 bg-stone-900/85 px-2 py-1 font-['Silkscreen',monospace] text-[10px] font-bold leading-none text-amber-300 pointer-events-auto select-none hover:text-amber-200"
            style={
                mobile ? { left: TOP_CHIP_LEFT_PX, top: topChipTop(0), right: 'auto' } : undefined
            }
        >
            <Languages className="size-3 text-amber-400" />
            {isChinese ? '中文' : 'EN'}
        </button>
    );
}
