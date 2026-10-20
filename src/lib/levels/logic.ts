/**
 * src/lib/levels/logic.ts
 * --------------------------------------------------------------------------
 * Pure level decisions shared by the scene glue and the data tests.
 */

import type { Teleporter } from './types';

/**
 * Is a teleporter usable yet?
 *
 * A portal stays dark until the level's monsters are cleared, unless it opts
 * out with `requiresClear: false` — the tavern exit, which must never be
 * gated. The tavern used to be exempt as a whole scene, which made it
 * impossible to gate anything inside it; the hidden level 1 entrance needs
 * exactly that (the tavern's only monster is the wall ornament), so the
 * decision now lives per portal.
 */
export function isPortalArmed(
    spec: Pick<Teleporter, 'requiresClear'>,
    monstersCleared: boolean,
): boolean {
    return spec.requiresClear === false || monstersCleared;
}
