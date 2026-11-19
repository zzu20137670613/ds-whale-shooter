/**
 * src/components/hud/token-shield-badge.tsx
 * --------------------------------------------------------------------------
 * 词元盾 chip, pinned directly under the whale-girl's 【鲸鱼娘本人游玩】 chip.
 *
 * The owner: `词元盾 buff 位置就放在鲸鱼娘本人游玩正下方，词元盾介绍直接复用鲸鱼娘本人游玩
 * buff 的显示逻辑，改为5级每级效果XXXX`。
 *
 * So this is the same widget, one row down: a chip that says what the buff is, with the
 * numbers only on hover (`数值什么的悬浮才能看到`) - and on a phone, where there is no
 * hover, the same lines open on a tap and any other tap closes them.
 *
 * The level lives per character in the save (`tokenShieldByCharacter`), so switching to a
 * character who never picked one up hides the chip again.
 */

import React from 'react';

import {
    TOKEN_SHIELD_MAX_LEVEL,
    tokenShieldLevels,
    tokenShieldShare,
} from '@/lib/drops/token-shield';
import { tokenShieldLevelOf } from '@/lib/drops/token-shield-store';
import { isMobileLike } from '@/lib/mobile';
import { t } from '@/locales';

import { BUFF_CHIP_SHELL, BUFF_CHIP_TONE, BUFF_CHIP_WIDTH } from './pet-buff-badge';
import { useGameStore } from '@/store/game-store';

const SHIELD_ICON = '/assets/image/weapons/rune-shield.png';

export const TokenShieldBadge: React.FC = () => {
    const characterId = useGameStore((s) => s.selectedCharacterId ?? undefined);
    // Subscribed so a pickup re-renders the chip (the map itself is the source of truth).
    useGameStore((s) => s.tokenShieldByCharacter);
    // And so a language switch re-renders the tooltip (`t()` reads module state).
    useGameStore((s) => s.locale);

    const level = tokenShieldLevelOf(characterId);
    const mobile = isMobileLike();
    const [open, setOpen] = React.useState<boolean>(false);

    if (level <= 0) return null;

    const percent = Math.round(tokenShieldShare(level) * 100);
    const maxed = level >= TOKEN_SHIELD_MAX_LEVEL;

    const lines = [
        `${t('tokenShield.title')} Lv.${level} / ${TOKEN_SHIELD_MAX_LEVEL}`,
        t('tokenShield.current', { percent }),
        // 5 级每级效果，一行一级，当前那一级高亮（见下面 index 比较）。
        ...tokenShieldLevels().map((entry) =>
            t('tokenShield.perLevel', { level: entry.level, percent: entry.percent }),
        ),
        maxed ? t('tokenShield.atMax') : t('tokenShield.note'),
    ];

    const chip = (
        <div
            data-testid="token-shield-badge"
            data-token-shield-level={level}
            title={lines.join('\n')}
            aria-label={lines.join(' · ')}
            role={mobile ? 'button' : undefined}
            aria-expanded={mobile ? open : undefined}
            onPointerDown={
                mobile
                    ? (e: React.PointerEvent<HTMLDivElement>) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpen((current) => !current);
                      }
                    : undefined
            }
            className={[
                // 与鲸鱼娘徽章同一套外壳、同一宽度（主人 2026-11-12）。
                BUFF_CHIP_SHELL,
                BUFF_CHIP_WIDTH,
                BUFF_CHIP_TONE.sky,
                mobile ? 'cursor-pointer active:brightness-125' : 'cursor-help',
            ].join(' ')}
        >
            <img
                data-token-shield-icon
                src={SHIELD_ICON}
                alt=""
                aria-hidden="true"
                className="size-[19px] object-contain"
            />
            <span className="text-[15px] leading-none">
                {t('tokenShield.title')} Lv.{level}
            </span>
        </div>
    );

    if (!mobile) return chip;

    return (
        <div className="relative" data-testid="token-shield-badge-host">
            {chip}
            {open && (
                <>
                    {/* Anywhere else on screen closes it, including a second tap on the chip. */}
                    <div
                        data-testid="token-shield-scrim"
                        aria-hidden="true"
                        className="fixed inset-0 z-[35] bg-transparent"
                        onPointerDown={() => setOpen(false)}
                    />
                    <div
                        data-testid="token-shield-panel"
                        className="absolute top-full right-0 z-[36] mt-2 w-[268px] border-2 border-violet-400/80 bg-stone-950/95 px-3 py-2 font-['Silkscreen',monospace] text-[13px] leading-relaxed text-violet-100 shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {lines.map((line, index) => (
                            <div
                                key={line}
                                className={
                                    index === 0
                                        ? 'mb-1 font-bold text-violet-200'
                                        : // `perLevel` rows run index 2..6; the current level is
                                          // index + 1 === level.
                                          index >= 2 && index - 1 === level
                                          ? 'font-bold text-violet-50'
                                          : 'text-violet-100/85'
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