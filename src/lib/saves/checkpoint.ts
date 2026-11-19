/**
 * src/lib/saves/checkpoint.ts
 * --------------------------------------------------------------------------
 * When to write the "map cleared" auto save.
 *
 * The owner: `自动存档也优化一下，在每关清理完所有怪物出传送阵的这个触发点，触发一次自动存档`。
 *
 * The trigger already knows its own state (cleared? already appeared? already saved?),
 * so the decision is a pure function: one place to read, one place to test, and no way
 * for the scene to get it subtly wrong in two different touch paths.
 */

export interface ClearCheckpointState {
    /** The level's monsters are all gone (`isLevelCleared`). */
    cleared: boolean;
    /** This portal has already faded in during this visit. */
    hasAppeared: boolean;
    /** A checkpoint was already taken during this visit. */
    alreadySaved: boolean;
    /** The level editor is open: portals are being placed, not played. */
    editorActive: boolean;
}

/**
 * True on the single frame a level becomes clear and its exit portal fades in.
 *
 * Deliberately not "on load of an already-clear level": re-entering a finished map
 * must not write a checkpoint, because the interesting moment is the last monster
 * dying, not the player walking back in.
 */
export function shouldSaveOnClear(state: ClearCheckpointState): boolean {
    if (state.editorActive) return false;
    if (state.alreadySaved) return false;
    if (state.hasAppeared) return false;
    return state.cleared;
}