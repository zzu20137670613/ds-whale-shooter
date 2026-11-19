import React from 'react';
import { Heart, Zap } from 'lucide-react';
import { useGameStore } from '@/store/game-store';
import { t } from '@/locales';
import { useIsMobile } from '@/lib/use-is-mobile';
import { MOBILE_CARD_WIDTH_PX } from '@/lib/hud/mobile-layout';

import { CornerPixels, RETRO_BOX } from './retro-box';
import { SkillBadge } from './skill-badge';

export const CharacterHUDOverlay: React.FC = () => {
    const { characterName, playerNickname, hp, maxHp, sp, maxSp, hubsVisible, petBonus } =
        useGameStore();
    // The nickname the player typed replaces the character's own name, so the run is
    // played as themselves (`将我们定下的5个角色的名字顶替掉`).
    const displayName = playerNickname || characterName;
    const mobile = useIsMobile();

    // Show whenever the character exists. Previously gated on
    // `!tavernCleared` to avoid a stale characterName during tavern
    // phase 1, but the player needs HP/SP feedback after picking up
    // weapons in the tavern too — characterName is only set once the
    // real character is loaded, so phase 1 still renders nothing.
    if (!hubsVisible || !characterName) return null;

    const hpPercent = Math.max(0, Math.min(100, (hp / (maxHp || 1)) * 100));
    const spPercent = Math.max(0, Math.min(100, (sp / (maxSp || 1)) * 100));

    if (mobile) {
        // Vertical stack: character name on top, then HP + SP bars.
        // The bar fills the available row width and the current /
        // max value sits right-aligned at the bar's end with a black
        // stroke so it's legible against the fill colour.
        return (
            <div
                className="absolute top-4 left-4 z-20 pointer-events-none select-none font-['Silkscreen',monospace]"
                // 宽度走常量：左上角的语言/金钱要贴着它右边摆，两边必须读同一个数。
                style={{ width: MOBILE_CARD_WIDTH_PX }}
            >
                <div className="flex flex-col gap-1.5 bg-stone-950/55 px-2.5 py-1.5 border border-amber-900/60 backdrop-blur-sm">
                    <span className="flex items-baseline gap-1.5 text-[10px] font-bold tracking-wider text-amber-200 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {displayName}
                        {/* The desktop pet's tier. Visible on purpose: the bonus
                            is invisible in the numbers, so without this the
                            player has no way to tell the bridge worked. */}
                        {petBonus && (
                            <span
                                data-testid="pet-bonus-chip"
                                title={`${petBonus.label} · +${petBonus.percent}%`}
                                className="text-[8px] font-normal tracking-normal text-emerald-300/90 normal-case"
                            >
                                ⌁{petBonus.label} +{petBonus.percent}%
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <Heart className="w-3 h-3 fill-red-500 text-red-400 shrink-0" />
                        <div className="flex-1 h-2 bg-black border border-red-950 relative">
                            <div
                                className="h-full bg-red-600 transition-all duration-150"
                                style={{ width: `${hpPercent}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-end pr-1 text-[9px] font-bold text-white leading-none drop-shadow-[1px_1px_0px_#000]">
                                {Math.ceil(hp)}/{maxHp}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 fill-sky-400 text-sky-300 shrink-0" />
                        <div className="flex-1 h-2 bg-black border border-sky-950 relative">
                            <div
                                className="h-full bg-sky-500 transition-all duration-150"
                                style={{ width: `${spPercent}%` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-end pr-1 text-[9px] font-bold text-white leading-none drop-shadow-[1px_1px_0px_#000]">
                                {Math.ceil(sp)}/{maxSp}
                            </span>
                        </div>
                        <SkillBadge />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none select-none flex flex-col gap-2 font-['Silkscreen',monospace]">
            {/* Retro Pixel Box - Dark Outer Border + Amber Accent Corners */}
            <div className={`${RETRO_BOX} relative p-3.5 min-w-[260px]`}>
                <CornerPixels />

                {/* Character Name & Icon Header */}
                <div className="flex items-center gap-2 mb-2 pb-1 border-b-2 border-amber-900/60">
                    <div className="w-2.5 h-2.5 bg-amber-500 border border-black animate-pulse" />
                    <span className="text-xs font-bold tracking-wider text-amber-200 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {displayName}
                    </span>
                </div>

                {/* Bars section */}
                <div className="flex flex-col gap-2.5">
                    {/* HP Bar */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs font-bold leading-none">
                            <span className="text-red-400 flex items-center gap-1.5 drop-shadow-[1px_1px_0px_#000]">
                                <Heart className="w-4 h-4 fill-red-500 text-red-400 shrink-0" />
                                <span className="leading-none">HP</span>
                            </span>
                            <span className="text-stone-200 font-mono tracking-tighter drop-shadow-[1px_1px_0px_#000] leading-none">
                                {Math.ceil(hp)} / {maxHp}
                            </span>
                        </div>
                        <div className="h-3.5 w-full bg-black p-0.5 border border-red-950">
                            <div
                                className="h-full bg-red-600 border-r border-red-400 transition-all duration-150 ease-out"
                                style={{ width: `${hpPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* SP Bar */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs font-bold leading-none">
                            <span className="text-sky-400 flex items-center gap-1.5 drop-shadow-[1px_1px_0px_#000]">
                                <Zap className="w-4 h-4 fill-sky-400 text-sky-300 shrink-0" />
                                <span className="leading-none">SP</span>
                                <SkillBadge />
                            </span>
                            <span className="text-stone-200 font-mono tracking-tighter drop-shadow-[1px_1px_0px_#000] leading-none">
                                {Math.ceil(sp)} / {maxSp}
                            </span>
                        </div>
                        <div className="h-2.5 w-full bg-black p-0.5 border border-sky-950">
                            <div
                                className="h-full bg-sky-500 border-r border-sky-300 transition-all duration-150 ease-out"
                                style={{ width: `${spPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Key hints live outside the card: inside, they read as a second
                skill key and crowd the E badge. */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] bg-stone-900/85 text-sky-300 px-1.5 py-1 border border-stone-600 rounded-[2px] leading-none tracking-tight">
                    {t('hud.spaceKey')}
                </span>
                <span className="text-[11px] bg-stone-900/85 text-amber-300 px-1.5 py-1 border border-stone-600 rounded-[2px] leading-none tracking-tight">
                    {t('hud.reloadKey')}
                </span>
                <span className="text-[11px] bg-stone-900/85 text-violet-300 px-1.5 py-1 border border-stone-600 rounded-[2px] leading-none tracking-tight">
                    {t('hud.skillKey')}
                </span>
                <span className="text-[11px] bg-stone-900/85 text-rose-300 px-1.5 py-1 border border-stone-600 rounded-[2px] leading-none tracking-tight">
                    {t('hud.attackKey')}
                </span>
                <span className="text-[11px] bg-stone-900/85 text-emerald-300 px-1.5 py-1 border border-stone-600 rounded-[2px] leading-none tracking-tight">
                    {t('hud.bagKey')}
                </span>
            </div>
        </div>
    );
};
