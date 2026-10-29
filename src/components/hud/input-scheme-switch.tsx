/**
 * src/components/hud/input-scheme-switch.tsx
 * --------------------------------------------------------------------------
 * The corner chip that says how you are aiming, and lets you change it.
 *
 * Two schemes, never both: the cursor aims (manual), or the arrow keys aim (eight
 * ways). It sits top-right, semi-transparent, and stays out of the way — it is a
 * reminder plus a shortcut, not a menu.
 *
 * Desktop only by design: on a phone the only real answer is the walk direction, so
 * there is nothing to switch. The parent decides whether to mount it; this component
 * never guesses.
 */

import React from 'react';
import { Keyboard, MousePointer2 } from 'lucide-react';

import { useGameStore } from '@/store/game-store';
import { t } from '@/locales';

export const InputSchemeSwitch: React.FC = () => {
    const scheme = useGameStore((s) => s.inputScheme);
    const setScheme = useGameStore((s) => s.setInputScheme);

    const options = [
        { id: 'mouse' as const, label: t('input.mouse'), Icon: MousePointer2 },
        { id: 'directional' as const, label: t('input.directional'), Icon: Keyboard },
    ];

    return (
        <div className="pointer-events-auto absolute right-3 top-16 flex gap-1 rounded-md border border-white/20 bg-black/35 px-1 py-1 backdrop-blur-sm">
            {options.map(({ id, label, Icon }) => {
                const active = scheme === id;
                return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setScheme(id)}
                        aria-pressed={active}
                        title={label}
                        className={[
                            'flex items-center gap-1 rounded px-2 py-1 text-[11px] leading-none transition-colors',
                            active
                                ? 'bg-white/85 text-black'
                                : 'text-white/70 hover:bg-white/15 hover:text-white',
                        ].join(' ')}
                    >
                        <Icon size={12} strokeWidth={2} />
                        <span>{label}</span>
                    </button>
                );
            })}
        </div>
    );
};