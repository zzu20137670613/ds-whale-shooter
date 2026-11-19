/**
 * src/components/hud/seed-shop-panel.tsx
 * --------------------------------------------------------------------------
 * seed's shop: four doors and a way out.
 *
 * The owner: `商店内容变一下（复用格式，但是内容是全新的），5个按钮：（1）探索Claude的星空图书馆
 * （2）探索GPT的天空之城（3）探索dsh的亚特兰蒂斯（4）探索未至之境（5）取消。其中前四个按钮在上，
 * 取消按钮复用商店最下方的关闭按钮。`
 *
 * The bones are the mysterious merchant's (`shop-panel.tsx`): same RETRO_BOX, same
 * click-the-backdrop behaviour, same bottom cancel button. What it sells is different - the
 * merchant sells upgrades, seed hands out destinations - so the contents are their own file
 * rather than a mode switch inside the merchant's panel.
 *
 * 未至之境 is drawn in rainbow and does nothing yet: the owner is still designing what is
 * behind that door (`按钮逻辑之后实现，是我的一个大设想`).
 */

import React, { useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';

import { SEED_SHOP_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { resolveAndRestart } from '@/lib/phaser-game';
import { SEED_DESTINATIONS, destinationIsOpen } from '@/lib/story/seed-shop';
import { subscribeCurrentLevel } from '@/lib/levels/current-level';
import { t } from '@/locales';
import { useGameStore } from '@/store/game-store';
import { CornerPixels, RETRO_BOX } from './retro-box';

/**
 * The rainbow for 未至之境.
 *
 * Painted as a background clipped to the text rather than a colour per character: it stays
 * one element, keeps its padding, and animates for free.
 */
const RAINBOW_TEXT =
    'bg-[linear-gradient(90deg,#f97316,#facc15,#4ade80,#22d3ee,#818cf8,#e879f9)] bg-clip-text text-transparent';

/**
 * The label span, not the button, carries the rainbow.
 *
 * `background-clip: text` clips the gradient to the element's own box, and a gradient is sized to
 * that box. Put on the button, the box is the full width and the short label - centred - sampled
 * only the middle of the ramp, which rendered as flat cyan on the emulator. On an inline span the
 * box hugs the words, so the whole ramp shows.
 */

export const SeedShopPanel: React.FC = () => {
    const [open, setOpen] = useState<boolean>(false);
    // Subscribed so a language switch re-renders the labels.
    useGameStore((s) => s.locale);

    useEffect(() => {
        const handler = () => setOpen(true);
        EventBus.on(SEED_SHOP_EVENT, handler);
        return () => EventBus.off(SEED_SHOP_EVENT, handler);
    }, []);

    // A scene change closes it: the panel must not ride along to a new level.
    useEffect(() => subscribeCurrentLevel(() => setOpen(false)), []);

    if (!open) return null;

    const travel = (levelId: string): void => {
        // Close first: the panel is a React overlay and the level swap rebuilds the scene
        // underneath it (`shop-panel` learned the same lesson with its walk-home button).
        setOpen(false);
        void resolveAndRestart(levelId);
    };

    const press = (levelId: string | null): void => {
        if (levelId) {
            travel(levelId);
            return;
        }
        // 未至之境: alive and pressable, but honest about having nothing behind it yet.
        // 先把弹框关掉再说这句话 —— 主人 2026-11-16：`现在虽然字体显示了，但是被弹框盖住了，
        // 实际看不到，需要自动关闭弹框让字体显露出来`。
        setOpen(false);
        useGameStore.getState().showNotice(t('seedShop.notYet'));
    };

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 select-none"
            data-testid="seed-shop"
            onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
            }}
        >
            <div className={`${RETRO_BOX} relative w-[290px] p-4 font-['Silkscreen',monospace]`}>
                <CornerPixels />
                <div className="mb-3 border-b-2 border-amber-900/60 pb-2">
                    <span className="text-sm font-bold tracking-wider text-amber-200 uppercase">
                        {t('seedShop.title')}
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    {SEED_DESTINATIONS.map((destination) => {
                        const open = destinationIsOpen(destination);
                        return (
                            <button
                                key={destination.id}
                                type="button"
                                data-testid={`seed-destination-${destination.id}`}
                                onClick={() => press(destination.levelId)}
                                className={[
                                    'flex items-center justify-center gap-2 border px-2 py-2 text-[13px] font-bold leading-tight transition-colors',
                                    'border-amber-800/80 bg-stone-900/80 hover:border-amber-400',
                                    open ? '' : 'opacity-90',
                                ].join(' ')}
                            >
                                {destination.rainbow && (
                                    <Compass className="size-3.5 text-cyan-300" />
                                )}
                                <span
                                    data-testid={`seed-destination-label-${destination.id}`}
                                    className={
                                        destination.rainbow ? RAINBOW_TEXT : 'text-amber-100'
                                    }
                                >
                                    {t(`seedShop.${destination.label}`)}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* The merchant shop's bottom close button, relabelled 取消 - same slot, same
                    look, so a player who has used one shop already knows how to leave this. */}
                <button
                    type="button"
                    data-testid="seed-shop-cancel"
                    onClick={() => setOpen(false)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 border border-stone-600 bg-stone-900/80 px-2 py-1.5 text-[12px] text-stone-200 hover:border-stone-400"
                >
                    <X className="size-3" />
                    {t('seedShop.cancel')}
                </button>
            </div>
        </div>
    );
};
