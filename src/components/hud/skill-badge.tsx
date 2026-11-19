/**
 * src/components/hud/skill-badge.tsx
 * --------------------------------------------------------------------------
 * The little `E` badge that hangs off the SP label.
 *
 * Nothing in the game told the player which key casts the character's skill,
 * or why a press did nothing. This badge answers both:
 *
 *   ready    — sky blue, the skill will fire
 *   cooling  — grey, still on cooldown (or the headgear is already worn)
 *   no-sp    — red, the SP pool cannot pay the cost
 *
 * and it flashes on the frame the skill actually fires.
 *
 * The scene publishes the state on the bus (`skill:status`) at ~10Hz and
 * (`skill:used`) on a successful cast; this component owns no game state.
 */

import { useEffect, useState } from 'react';

import { skillBadgeTone, type SkillBadgeTone } from '@/lib/characters/skill';
import { EventBus } from '@/lib/events/bus';

export interface SkillStatusPayload {
    /** Milliseconds until the skill may be used again (0 = ready). */
    readyInMs: number;
    sp: number;
    /** What one cast costs right now for this character. */
    spCost: number;
    /** A worn headgear blocks re-use; see `skillBadgeTone`. */
    wornHits?: number;
}

const TONE_CLASS: Record<SkillBadgeTone, string> = {
    ready: 'border-sky-400 bg-sky-500/30 text-sky-100',
    cooling: 'border-stone-600 bg-stone-800 text-stone-500',
    'no-sp': 'border-red-500 bg-red-900/60 text-red-300',
};

/** How long the fired-flash stays on, ms. */
const FLASH_MS = 260;

export function SkillBadge() {
    const [status, setStatus] = useState<SkillStatusPayload | null>(null);
    const [flashing, setFlashing] = useState(false);

    useEffect(() => {
        const onStatus = (next?: SkillStatusPayload) => {
            if (next) setStatus(next);
        };
        const onUsed = () => {
            setFlashing(true);
        };
        EventBus.on('skill:status', onStatus);
        EventBus.on('skill:used', onUsed);
        return () => {
            EventBus.off('skill:status', onStatus);
            EventBus.off('skill:used', onUsed);
        };
    }, []);

    // Drop the flash on a timer rather than a CSS animation so a rapid
    // second cast restarts it cleanly.
    useEffect(() => {
        if (!flashing) return;
        const id = window.setTimeout(() => setFlashing(false), FLASH_MS);
        return () => window.clearTimeout(id);
    }, [flashing]);

    // No status yet means the character has no skill at all — show nothing
    // rather than a permanently dead badge.
    if (!status) return null;

    const tone = skillBadgeTone(status);
    const flash = flashing ? 'scale-125 border-amber-200 bg-amber-300 text-black' : '';

    return (
        <span
            data-testid="skill-badge"
            data-tone={tone}
            title={status.spCost > 0 ? `E · ${status.spCost} SP` : 'E'}
            className={`ml-1 inline-flex items-center justify-center rounded-[2px] border px-1 py-0.5 text-[9px] font-bold uppercase leading-none tracking-tighter transition-transform duration-100 ${TONE_CLASS[tone]} ${flash}`}
        >
            E
        </span>
    );
}
