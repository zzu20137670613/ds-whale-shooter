/**
 * src/components/hud/money-hud.tsx
 * --------------------------------------------------------------------------
 * The player's wallet — a small coin chip, now in the top-left corner.
 *
 * Money is earned as a per-monster bounty (`monsters/monster.ts` → `kill()`)
 * and spent in the tavern shop, so this readout is shared by both sides of
 * that loop: watch it climb in combat, watch it drop when you buy.
 *
 * It used to live at the top-right. The owner, 2026-11-15:
 * `将PC端右上角显示的中英文切换和钱币数量移到左上角` — on desktop the character bars
 * sit bottom-left (`character-hud-overlay`), so the whole top-left corner was
 * empty. Locale sits on top (`top-4`), the wallet one chip below (`top-12`).
 *
 * Styling follows the HUD house rules: Tailwind utilities inline, lucide
 * icon, the shared Silkscreen pixel font, no new `.css` file.
 */
import { Coins } from 'lucide-react';

import { TOP_CHIP_LEFT_PX, topChipTop } from '@/lib/hud/mobile-layout';
import { isMobileLike } from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

export function MoneyHud() {
    const money = useGameStore((s) => s.money);
    const hubsVisible = useGameStore((s) => s.hubsVisible);

    // Hidden with the rest of the HUD (death, settings, tavern phase 1).
    if (!hubsVisible) return null;

    // 手机端：血蓝卡片右边一列的第二格。
    // 桌面端：主人 2026-11-15 把这两块一起挪到了左上角（语言在上，钱在下）。
    const mobile = isMobileLike();

    return (
        <div
            data-testid="money-hud"
            className="absolute top-12 left-4 z-20 flex items-center gap-1.5 border-2 border-amber-900/80 bg-stone-900/85 px-2 py-1 font-['Silkscreen',monospace] pointer-events-none select-none"
            style={
                mobile ? { left: TOP_CHIP_LEFT_PX, top: topChipTop(1), right: 'auto' } : undefined
            }
        >
            <Coins className="size-3 text-amber-400" />
            <span className="text-[11px] font-bold leading-none text-amber-300 tabular-nums drop-shadow-[1px_1px_0px_#000]">
                {money}
            </span>
        </div>
    );
}
