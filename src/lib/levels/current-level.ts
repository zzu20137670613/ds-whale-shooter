/**
 * src/lib/levels/current-level.ts
 * --------------------------------------------------------------------------
 * Module-level cache of the level most recently loaded by the Phaser scene.
 *
 * Exists so the editor panel (which lives in a lazy chunk and may mount
 * AFTER the scene has already fired `level-loaded`) can pick up the
 * current level instead of waiting for the next one. Lives in `src/lib/`
 * because both the scene (writes) and the panel (reads) depend on it.
 */

import type { Level } from './types';

export interface CurrentLevel {
    id: string;
    level: Level;
}

let current: CurrentLevel | null = null;

/** Called with the new level every time the scene loads one. */
export type CurrentLevelListener = (next: CurrentLevel | null) => void;

const listeners = new Set<CurrentLevelListener>();

export function setCurrentLevel(payload: CurrentLevel | null): void {
    current = payload;
    // One throwing listener must not take the scene load down with it: the level is
    // already cached, and the rest of the listeners may still need to hear about it.
    for (const listener of [...listeners]) {
        try {
            listener(payload);
        } catch {
            // ignored on purpose - see above
        }
    }
}

export function getCurrentLevel(): CurrentLevel | null {
    return current;
}

/**
 * Watch for map switches. Returns the unsubscribe function.
 *
 * The shop panel rides above the Phaser scene and is never unmounted by a scene change, so
 * this is how it learns that the player walked through a portal.
 */
export function subscribeCurrentLevel(listener: CurrentLevelListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Tests only. */
export function resetCurrentLevel(): void {
    current = null;
    listeners.clear();
}
