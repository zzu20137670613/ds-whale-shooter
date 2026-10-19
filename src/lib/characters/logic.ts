/**
 * src/lib/characters/logic.ts
 * --------------------------------------------------------------------------
 * Pure roster helpers. No IO, no Phaser: the loader fetches, the scene
 * resolver wires, and the decisions live here where they are cheap to test.
 */

/**
 * Validate a persisted character id against the current `index.yaml` roster.
 *
 * The save file stores the id rather than the spec, so a rename or a retired
 * character leaves an id behind that no YAML answers to — `whale-girl` became
 * `deepseek`, and an existing save still said the old name. Fetching a spec
 * for it would reject and the scene would never boot, so an unknown id is
 * treated as "nobody has picked": the caller sends the player back through
 * character select instead of failing.
 *
 * Returns the id when it is still on the roster, otherwise null (which also
 * covers the fresh-start case of nothing selected at all).
 */
export function resolveRosterCharacterId(
    storedId: string | null | undefined,
    roster: string[],
): string | null {
    if (!storedId) return null;
    return roster.includes(storedId) ? storedId : null;
}