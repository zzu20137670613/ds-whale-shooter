/**
 * src/components/hud/save-hotkeys.tsx
 * --------------------------------------------------------------------------
 * F5 saves into the quick slot; F9 loads it.
 *
 * Not Ctrl+S: the browser keeps that one for "save page", and a game that fights the
 * browser loses. F5 is the galgame's choice too, so a player coming from there already
 * has the reflex.
 *
 * Both keys are swallowed (`preventDefault`) — F5 reloads the page, which would throw
 * away the run the player was trying to keep.
 */

import { useEffect } from 'react';

import { announceSave, quickLoad, quickSave } from '@/lib/saves/quick';
import { t } from '@/locales';

export function SaveHotkeys() {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.repeat) return;
            // A menu with a text field in it must keep its own typing.
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

            if (e.key === 'F5') {
                e.preventDefault();
                const record = quickSave();
                announceSave(record ? t('saves.saved') : t('saves.tooEarly'));
                return;
            }

            if (e.key === 'F9') {
                e.preventDefault();
                // `quickLoad` restarts the saved level itself; a failure here means the
                // slot is empty, which is worth saying out loud.
                if (!quickLoad()) announceSave(t('saves.empty'));
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return null;
}