/**
 * src/components/hud/pet-buff-badge.tsx
 * --------------------------------------------------------------------------
 * The whale-girl's desktop-pet chip, one slot left of the aim switch.
 *
 * 第七世's desktop pet gives her a buff while she is the one being played; until now the
 * player had no way to see whether it was on, or what it was worth. The chip says only
 * 【鲸鱼娘本人游玩】 - the owner's call: `数值什么的悬浮才能看到`.
 *
 * How the numbers are reached depends on how the player points at things:
 *
 *   - Desktop: the native `title` tooltip, shown by hovering (`悬浮显示`).
 *   - Phone: there is no hover at all, so a tap opens the same panel under the chip and any
 *     other tap closes it (`手机端就是点一下显示，然后点一下任意位置取消显示`).
 *
 * Renders nothing when there is no buff: no pet, no session, or another character.
 */

import React from 'react';

import { petBuffFacts } from '@/lib/pet/badge';
import { isMobileLike } from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';
import { t } from '@/locales';

import { CornerPixels } from './retro-box';

/**
 * HUD buff chip 的共用外壳。
 *
 * 主人 2026-11-12：`词元盾 buff 背景色改成跟鲸鱼娘 buff 一样的背景色，宽度也是（之前没有直接复用？）`。
 * 之前词元盾自己抄了一份紫罗兰配色，现在两枚徽章共用同一套 class，宽度也钉成一样，叠在一起才齐。
 */
export const BUFF_CHIP_SHELL =
    'pointer-events-auto flex items-center gap-1.5 rounded-md border px-2 py-1.5 font-bold leading-none backdrop-blur-sm';

/** 普通档（sky）与满级档（orange）的配色，两枚徽章都用它。 */
export const BUFF_CHIP_TONE = {
    sky: 'border-sky-300/40 bg-sky-500/15 text-sky-100',
    blessing:
        'border-orange-400/80 bg-stone-950/85 text-orange-50 shadow-[0_0_10px_rgba(251,146,60,0.45)]',
} as const;

/**
 * 两枚徽章同宽，才能在右上角叠成一列。
 *
 * 主人 2026-11-13：`鲸鱼娘本人游玩 buff 总宽度缩减 1/6`。212 → 212 x 5/6 ≈ 177。
 * 词元盾徽章共用这一条，所以两枚一起变窄、依旧左右对齐。
 */
export const BUFF_CHIP_WIDTH = 'min-w-[177px]';

export const PetBuffBadge: React.FC = () => {
    const petBonus = useGameStore((s) => s.petBonus);
    const characterId = useGameStore((s) => s.selectedCharacterId ?? undefined);
    // Subscribed so a language switch re-renders the tooltip (t() is module state).
    useGameStore((s) => s.locale);

    const facts = petBuffFacts(petBonus?.percent, characterId);
    // The phone has no hover, so the same lines are reachable by tapping the chip.
    const mobile = isMobileLike();
    const [open, setOpen] = React.useState<boolean>(false);

    if (!facts) return null;

    // Every row PC shows, including a zero luck: the phone panel is meant to be the same
    // readout reached a different way, and a missing row would read as a different buff.
    const lines = [
        t('pet.buff.title'),
        t('pet.buff.subtitle'),
        `${t('pet.buff.panels')} +${facts.percent}%`,
        `${t('pet.buff.luck')} +${facts.luck}`,
        facts.blessing ? t('pet.buff.blessing') : '',
    ].filter(Boolean);

    const chip = (
        <div
            data-testid="pet-buff-badge"
            data-pet-percent={facts.percent}
            title={lines.join('\n')}
            aria-label={lines.join(' · ')}
            role={mobile ? 'button' : undefined}
            aria-expanded={mobile ? open : undefined}
            onPointerDown={
                mobile
                    ? (e: React.PointerEvent<HTMLDivElement>) => {
                          // The scrim below listens for its own pointerdown; opening here and
                          // letting the same press bubble out would close it in the same frame
                          // (the bug the backpack chip had).
                          e.preventDefault();
                          e.stopPropagation();
                          setOpen((current) => !current);
                      }
                    : undefined
            }
            className={[
                // Two steps up from the 11 px it shipped at: the owner wants the chip to read
                // as a badge, not as fine print (`这个buff大一点有排面`).
                BUFF_CHIP_SHELL,
                BUFF_CHIP_WIDTH,
                mobile ? 'cursor-pointer active:brightness-125' : 'cursor-help',
                // Top tier is a WARM WHITE on near-black, with an orange rim.
                //
                // Coloured text was the problem, not the hue: amber-200 read pale
                // (`黄色字体改成橙色字体`) and orange-300 then read muddy at 15 px, because a
                // tinted translucent background drags the text down to the same brightness as
                // the fill behind it. Warm white on the HUD's own black is ~17:1 contrast, and
                // the orange rim + glow still says "this is the special one" from across the
                // screen.
                facts.blessing ? BUFF_CHIP_TONE.blessing : BUFF_CHIP_TONE.sky,
            ].join(' ')}
        >
            <span data-pet-icon aria-hidden="true" className="text-[19px] leading-none">
                🐳
            </span>
            <span data-pet-label className="text-[15px] leading-none">
                {t('pet.buff.title')}
            </span>
        </div>
    );

    if (!mobile) return chip;

    return (
        <div className="relative" data-testid="pet-buff-badge-host">
            {chip}
            {open && (
                <>
                    {/* Anywhere else on screen closes it, including a second tap on the chip. */}
                    <div
                        data-testid="pet-buff-scrim"
                        aria-hidden="true"
                        className="fixed inset-0 z-[35] bg-transparent"
                        onPointerDown={() => setOpen(false)}
                    />
                    <div
                        data-testid="pet-buff-panel"
                        // A solid panel: `RETRO_BOX` is 40% black, and over a bright beach the
                        // numbers washed out (measured on the emulator screenshot).
                        className="absolute top-full right-0 z-[36] mt-2 w-[248px] border-2 border-amber-700/80 bg-stone-950/95 px-3 py-2 font-['Silkscreen',monospace] text-[13px] leading-relaxed text-amber-100 shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <CornerPixels />
                        {lines.map((line, index) => (
                            <div
                                key={line}
                                className={
                                    index === 0
                                        ? 'mb-1 font-bold text-orange-200'
                                        : 'text-amber-100/90'
                                }
                            >
                                {line}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
