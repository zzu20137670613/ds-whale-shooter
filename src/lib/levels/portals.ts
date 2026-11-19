/**
 * src/lib/levels/portals.ts
 * --------------------------------------------------------------------------
 * Which portals exist right now.
 *
 * A portal marked `hiddenUnlessUnlocked` is the galgame's seal-key door: until the key is
 * typed into the nickname dialog it must not be drawn, must not glow, and must not be
 * enterable. It looked like a level-data problem twice, but both times the drawing code had
 * simply created the view from the raw spec list and never asked.
 *
 * Kept pure so the rule can be tested without a Phaser scene.
 */

import type { Teleporter } from './types';

/** Whether this portal should exist in the world at all. */
export function isPortalVisible(spec: Teleporter, unlocked: boolean): boolean {
    return unlocked || !spec.hiddenUnlessUnlocked;
}

/** The specs to draw and to enter: everything, minus the doors this save has not earned. */
export function visibleTeleporters(
    specs: readonly Teleporter[] | undefined,
    unlocked: boolean,
): Teleporter[] {
    if (!specs) return [];
    return specs.filter((spec) => isPortalVisible(spec, unlocked));
}