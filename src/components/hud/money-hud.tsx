/**
 * src/components/hud/money-hud.tsx
 * --------------------------------------------------------------------------
 * The player's wallet — a small coin chip pinned to the top-right corner.
 *
 * Money is earned as a per-monster bounty (`monsters/monster.ts` → `kill()`)
 * and spent in the tavern shop, so this readout is shared by both sides of
 * that loop: watch it climb in combat, watch it drop when you buy.
 *
 * Top-right is the free corner — the character bars own top-left, weapons
 * bottom-right, the level clock sits top-centre, and the combo counter
 * hangs lower at `top-26 right-6`.
 *
 * Styling follows the HUD house rules: Tailwind utilities inline, lucide
 * icon, the shared Silkscreen pixel font, no new `.css` file.
 */
import { Coins } from 'lucide-react';

import { useGameStore } from '@/store/game-store';

export function MoneyHud() {
    const money = useGameStore((s) => s.money);
    const hubsVisible = useGameStore((s) => s.hubsVisible);

    // Hidden with the rest of the HUD (death, settings, tavern phase 1).
    if (!hubsVisible) return null;

    return (
        <div
            data-testid="money-hud"
            className="absolute top-12 right-4 z-20 flex items-center gap-1.5 border-2 border-amber-900/80 bg-stone-900/85 px-2 py-1 font-['Silkscreen',monospace] pointer-events-none select-none"
        >
            <Coins className="size-3 text-amber-400" />
            <span className="text-[11px] font-bold leading-none text-amber-300 tabular-nums drop-shadow-[1px_1px_0px_#000]">
                {money}
            </span>
        </div>
    );
}