/**
 * src/components/hud/death-overlay.tsx
 * --------------------------------------------------------------------------
 * Full-screen "you died" overlay with a Restart button. Rendered by
 * GameHUDLayer when `useGameStore().isDead` is true; the Phaser scene
 * is already paused at that point (see Character.handleDeath).
 *
 * Restart goes through `restartAtTavern` — the same helper the
 * settings panel uses. The Phaser scene is destroyed, the store is
 * wiped to `initialGameState` via `clearSaveData` (so a refresh
 * doesn't restore the dead run), and a fresh tavern `LoadScene` is
 * constructed. HP / weapons / character choice all re-seed from the
 * tavern phase-1 selection.
 */

import { Skull } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { restartAtTavern } from '@/lib/phaser-game';
import { t } from '@/locales';
import { useGameStore } from '@/store/game-store';

import { CornerPixels, RETRO_BOX } from './retro-box';

export function DeathOverlay() {
    const isDead = useGameStore((s) => s.isDead);
    // Subscribed, not used: the overlay has to repaint when the language flips,
    // and `t()` is a module-level lookup that React cannot see changing.
    const locale = useGameStore((s) => s.locale);
    if (!isDead) return null;

    return (
        <div
            data-testid="death-overlay"
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
        >
            <div
                key={locale}
                className={`${RETRO_BOX} relative flex flex-col items-center gap-4 px-10 py-8 font-['Silkscreen',monospace] min-w-[340px]`}
            >
                <CornerPixels />

                {/* Icon — large raw glyph, no container box */}
                <Skull
                    className="size-12 text-red-500"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.7))' }}
                />

                {/* Title + decorative divider */}
                <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="text-3xl font-bold tracking-[0.22em] text-red-400 drop-shadow-[2px_2px_0px_#000] uppercase">
                        {t('death.title')}
                    </div>
                    <div className="flex items-center gap-2 w-full">
                        <span className="flex-1 h-px bg-red-900/60" />
                        <span className="text-red-700 text-[10px] leading-none">✦</span>
                        <span className="flex-1 h-px bg-red-900/60" />
                    </div>
                </div>

                {/* Subtitle */}
                {/* The owner: 白色 + 两个字号。stone-500 at 10px was a caption nobody read. */}
                <div className="text-[14px] uppercase tracking-wider text-white text-center leading-relaxed">
                    {t('death.subtitle')}
                </div>

                {/* Restart button */}
                <Button
                    onClick={() => void restartAtTavern()}
                    className="mt-1 h-10 w-full bg-amber-500 px-6 font-['Silkscreen',monospace] font-bold text-white hover:bg-amber-400 tracking-wider uppercase text-[16px] rounded-none"
                >
                    {t('death.restart')}
                </Button>

                {/* Same size as the subtitle: at 8px this read as a footnote nobody could
                    make out (`回到海边亭台字体太小了`). */}
                <div className="text-[14px] tracking-wider text-stone-300 uppercase leading-relaxed">
                    {t('death.hint')}
                </div>
            </div>
        </div>
    );
}
