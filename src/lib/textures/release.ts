/**
 * src/lib/textures/release.ts
 * --------------------------------------------------------------------------
 * Which texture keys a scene may hand back when it shuts down.
 *
 * Phaser's TextureManager is game-wide: a texture that a scene loads stays
 * resident after that scene is torn down. Namespacing keys per scene (as
 * `background:<levelId>` does) avoids *collisions* — the old notes about
 * "every subsequent scene would render the first scene's background" are
 * exactly that symptom — but the memory stays until somebody releases it,
 * and each level background is ~17 MB today and 145 MB for the scrolling
 * maps being built now.
 *
 * Phaser reserves the `__` prefix for its own built-ins (`__DEFAULT`,
 * `__MISSING`, `__WHITE`), which every scene shares. Releasing those would
 * break rendering everywhere, so they are the one thing filtered out here.
 */

/** Phaser's built-in textures all live under this prefix. */
const BUILT_IN_PREFIX = '__';

/**
 * The subset of `loaded` that is safe to release: real texture keys, deduped,
 * with Phaser's built-ins removed. Sorted so the answer is the same for the
 * same input regardless of load order — the caller loops over it, but a
 * stable result is what makes this testable.
 */
export function releasableTextureKeys(loaded: Iterable<string>): string[] {
    const keys = new Set<string>();
    for (const key of loaded) {
        if (typeof key !== 'string' || key.length === 0) continue;
        if (key.startsWith(BUILT_IN_PREFIX)) continue;
        keys.add(key);
    }
    return [...keys].sort();
}