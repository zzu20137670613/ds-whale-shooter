/**
 * src/boot.ts
 * --------------------------------------------------------------------------
 * Runs before React mounts.
 *
 * `?reset=1` wipes this site's saved run and then boots normally.
 *
 * The owner hit a hang that only appeared after loading a save (`我最后是读档了然后就进不去了`).
 * A save that no longer matches the code can leave the boot waiting on a scene that never
 * finishes creating itself, and there is no way out from inside the game - the loading screen
 * is the only thing on screen. This is the way out: one URL, no devtools, no storage surgery.
 */

import { startBootLoading } from '@/lib/boot-loading/start';

/**
 * Keys the game writes. Kept in step with `store/game-store.ts` and `lib/saves/slots.ts`.
 *
 * The prefix matches the project identity (`ds-whale-shooter`). It used to be `11th_forest`, the
 * game's working title: the keys were renamed in one sweep when the whole project was renamed, and
 * the pre-release saves were deliberately not migrated — they were test data, and keeping a legacy
 * read path for them would have meant carrying the old name forward forever.
 */
const SAVE_KEYS = [
    'ds_whale_shooter_save_v2',
    'ds_whale_shooter_autosave',
    'ds_whale_shooter_store',
    'ds-whale-shooter-store',
];
const SAVE_KEY_PREFIXES = ['ds_whale_shooter', 'ds-whale-shooter'];

/**
 * `?clearTriggers=1` re-arms every one-shot trigger without touching the run.
 *
 * The throne egg and the beach juice are one-shot per save (the throne is one-shot per
 * character). Once spent they look exactly like a bug - the owner stood on the throne and
 * nothing happened, and the only remedy was wiping the whole save. This wipes just
 * `usedTriggers`, so the eggs can be re-tested on a run that is otherwise untouched.
 */
function clearTriggersIfAsked(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('clearTriggers') !== '1') return;
    const key = 'ds_whale_shooter_save_v2';
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
        if (parsed.state) {
            parsed.state.usedTriggers = [];
            window.localStorage.setItem(key, JSON.stringify(parsed));
            console.info('[boot] usedTriggers cleared - every egg is armed again');
        }
    } catch (error) {
        console.warn('[boot] could not clear usedTriggers', error);
    }
}

function resetSaveIfAsked(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== '1') return;

    try {
        for (const key of SAVE_KEYS) window.localStorage.removeItem(key);
        // Slot saves and anything else the game namespaced. Collected first: removing keys
        // while iterating `Object.keys` of the same storage is asking for trouble.
        const doomed = Object.keys(window.localStorage).filter((key) =>
            SAVE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
        );
        for (const key of doomed) window.localStorage.removeItem(key);
        window.sessionStorage.clear();
    } catch {
        // Private mode / storage disabled: nothing to clear, boot anyway.
    }
}

resetSaveIfAsked();
clearTriggersIfAsked();

void startBootLoading();
