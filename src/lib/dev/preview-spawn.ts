/**
 * src/lib/dev/preview-spawn.ts
 * --------------------------------------------------------------------------
 * `?at=8300,4600` drops the character at that world position on the next level load.
 *
 * Why this exists: some things can only be checked by standing somewhere — the throne easter egg
 * (`gpt-sky-city.yaml`, zone 7950,4430 720x360) and the merchant + cat at the four-block junction
 * are two of them, and both sit thousands of pixels from any spawn point. Filling a test save with
 * a position is not enough (`clearSceneSnapshots()` wipes `playerSnapshot` on every scene swap, so
 * a quick-load always lands on the level's own spawn), and the emulator cannot be driven that far.
 *
 * Same shape as the other preview hooks in `App.tsx` (`?settlement=`, `?comic=`, `?devmail`): a URL
 * parameter, read once, no UI. It is a DEV hook — it never fires on its own and does nothing unless
 * the parameter is present.
 *
 * One-shot, and never for the tavern: the tavern's spawn is its own stage and dropping the player
 * at arbitrary coordinates there would put her through the floor.
 */

const PARAM = 'at';

let consumed = false;

export interface PreviewSpawn {
    x: number;
    y: number;
}

/** `"8300,4600"` -> `{x: 8300, y: 4600}`; anything else -> null. */
export function parsePreviewSpawn(raw: string | null | undefined): PreviewSpawn | null {
    if (!raw) return null;
    const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

/**
 * The position `?at=` asks for, consumed on first use so a later scene swap does not teleport her
 * again. Returns null for the tavern, for a missing/broken parameter, and after the first call.
 */
export function takePreviewSpawn(levelId: string): PreviewSpawn | null {
    if (consumed) return null;
    if (levelId === 'tavern') return null;
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get(PARAM);
    const spawn = parsePreviewSpawn(raw);
    if (!spawn) return null;
    consumed = true;
    return spawn;
}

/** Test seam: forget that the hook already fired. */
export function resetPreviewSpawnForTests(): void {
    consumed = false;
}
