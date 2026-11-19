/**
 * src/components/hud/dev-cabin-panel.tsx
 * --------------------------------------------------------------------------
 * The developer cabin's computer, when you click it.
 *
 * It opens straight onto the compose window. It used to open on a fake login screen
 * (an email address and a password nobody could fail) and only then let you write - two
 * dialogs where one belongs, with a form that asked for nothing. The joke only works if
 * it is honest: this is the developer's desktop, and what you write ends up where he
 * actually reads.
 *
 * The window itself lives in `./letter-dialog` so the support panel can reuse it with its
 * own words without touching this one.
 */

import { useEffect } from 'react';

import { useGameStore } from '@/store/game-store';

import { LetterDialog } from './letter-dialog';

export function DevCabinPanel() {
    const open = useGameStore((s) => s.devCabinOpen);
    const close = useGameStore((s) => s.closeDevCabin);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    if (!open) return null;

    return <LetterDialog variant="cabin" onClose={close} testId="dev-cabin-panel" />;
}