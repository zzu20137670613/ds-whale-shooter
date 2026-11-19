/**
 * src/lib/pet/boot.ts
 * --------------------------------------------------------------------------
 * The one place the game talks to the pet at boot and at exit.
 *
 * Kept out of React on purpose: `beginPetSession` must run **once per page**,
 * and React StrictMode / HMR will happily run an effect twice - which would
 * suspend the pet, then suspend it again, and leave `suspendedByUs` describing a
 * state nobody can restore. Memoising the promise here makes the double-mount
 * harmless.
 */

import { type PetBonus, beginPetSession, endPetSession } from '@/lib/pet/lifetime';

export interface PetBootDeps {
    fetcher: (input: string, init?: RequestInit) => Promise<Response>;
    /** Where the result goes. The app hands this the store setter. */
    onBonus: (bonus: PetBonus) => void;
}

let started: Promise<PetBonus> | null = null;

/**
 * Read the pet's tier and put her away. Safe to call twice - the second call
 * gets the same promise back.
 */
export function startPetBridge(deps: PetBootDeps): Promise<PetBonus> {
    started ??= beginPetSession({ fetcher: deps.fetcher }).then((bonus) => {
        deps.onBonus(bonus);
        return bonus;
    });
    return started;
}

/**
 * Bind the exit hooks. `pagehide` is the one that fires on tab close, mobile
 * backgrounding and bfcache eviction; `beforeunload` is kept because some
 * desktop browsers only fire that one reliably.
 *
 * Returns an unsubscribe, which App calls on unmount (HMR / SPA teardown).
 */
export function installPetExitHooks(deps: PetBootDeps): () => void {
    let done = false;
    const leave = () => {
        if (done) return;
        done = true;
        void endPetSession({ fetcher: deps.fetcher });
    };
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', leave);
    return () => {
        window.removeEventListener('pagehide', leave);
        window.removeEventListener('beforeunload', leave);
        leave();
    };
}

/** Tests only. */
export function resetPetBridgeForTests(): void {
    started = null;
}
