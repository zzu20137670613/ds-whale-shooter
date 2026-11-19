/**
 * src/lib/weapons/level-label.ts
 * --------------------------------------------------------------------------
 * The rung printed after a weapon's name on its card.
 *
 * The card answers "how far is this gun from finished" at a glance: the bare number while
 * there is headroom, `max` once the ladder is spent. Never `4 / 4` - that eats the width the
 * magazine counter sits in.
 */

/** Label for a weapon's upgrade level: `0`…`max`. */
export function weaponLevelLabel(level: number, maxLevel: number): string {
    const max = Number.isFinite(maxLevel) ? Math.max(0, Math.floor(maxLevel)) : 0;
    const owned = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
    // The ladder's top rung only exists when there IS a ladder, so a gun that can never be
    // upgraded reports 0 rather than "max".
    if (max > 0 && owned >= max) return 'max';
    return String(owned);
}