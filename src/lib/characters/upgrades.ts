/**
 * src/lib/characters/upgrades.ts
 * --------------------------------------------------------------------------
 * Pure tavern-upgrade math. No Phaser, no store, no I/O.
 *
 * ── Why these four upgrades and not AwesomeTanks' ───────────────────────
 * AwesomeTanks sells armor / sight / turret / speed on a *tank*: gun sight
 * range and turret traverse. This shell is a top-down character shooter
 * with no turret and no camera zoom (grep found no `setZoom` anywhere), so
 * carrying those four over verbatim would have meant selling upgrades that
 * visibly do nothing. They are mapped onto the stats this shell actually
 * has instead:
 *
 *   armor    → hp          — soak more hits
 *   agility  → moveSpeed   — cross ground faster
 *   spirit   → sp, spRegenMs — bigger stamina pool, faster refill
 *   luck     → luck        — crit chance (critChance = luck / 10)
 *
 * Ladders live in each character's YAML (`upgrades:`), so prices and
 * effects are content, not code — a new upgrade is a YAML edit.
 *
 * ── Where the effect actually lands ────────────────────────────────────
 * `applyUpgrades` scales the CharacterSpec once, right after it is fetched
 * (`game/resolve-scene.ts`). Everything downstream — spawn HP, the HUD
 * bars, movement, and the save-restore clamp — reads that spec, so one
 * call site makes every upgrade real rather than sprinkling multipliers
 * through the movement, damage and HUD code.
 */

import type { CharacterSpec } from './types';

/** Stats an upgrade may move. */
export type UpgradeStat = 'hp' | 'sp' | 'moveSpeed' | 'spRegenMs' | 'luck';

/** Clamp a raw purchase level into `[0, ladderLength]`. */
export function clampUpgradeLevel(level: number | undefined, ladderLength: number): number {
    if (level === undefined || !Number.isFinite(level)) return 0;
    return Math.max(0, Math.min(ladderLength, Math.floor(level)));
}

/** Ladder length = its max level. 0 when the character has no such upgrade. */
export function maxUpgradeLevel(spec: CharacterSpec, upgradeId: string): number {
    return spec.upgrades?.[upgradeId]?.costs.length ?? 0;
}

/**
 * Price of the next level, or `null` when the ladder is maxed or the
 * character has no such upgrade. `currentLevel` is how many levels are
 * already bought, so the next price is `costs[currentLevel]`.
 */
export function upgradeCost(
    spec: CharacterSpec,
    upgradeId: string,
    currentLevel: number,
): number | null {
    const ladder = spec.upgrades?.[upgradeId];
    if (!ladder) return null;
    const level = clampUpgradeLevel(currentLevel, ladder.costs.length);
    if (level >= ladder.costs.length) return null;
    return ladder.costs[level];
}

/** Clamp a computed stat into the range its schema accepts. */
function clampStat(stat: UpgradeStat, value: number): number {
    switch (stat) {
        case 'hp':
        case 'sp':
            return Math.max(0, Math.round(value));
        case 'luck':
            // Schema: integer 1–10 (crit chance = luck / 10).
            return Math.max(1, Math.min(10, Math.round(value)));
        default:
            // moveSpeed / spRegenMs must stay > 0.
            return Math.max(0.01, value);
    }
}

/**
 * Return a copy of `spec` with every bought upgrade applied.
 *
 * A spec with no `upgrades` block, or with nothing bought, comes back
 * untouched. `mul` compounds per level (1.12 over 3 levels = 1.12³);
 * `add` is flat per level. A stat the spec does not define is skipped
 * rather than producing NaN.
 */
export function applyUpgrades(
    spec: CharacterSpec,
    levels: Record<string, number> = {},
): CharacterSpec {
    if (!spec.upgrades) return spec;

    let next: CharacterSpec = spec;
    for (const upgradeId of Object.keys(spec.upgrades)) {
        const ladder = spec.upgrades[upgradeId];
        const level = clampUpgradeLevel(levels[upgradeId], ladder.costs.length);
        if (level === 0) continue;

        // Each effect is applied against the running copy, so two effects
        // on the same stat would compound in list order.
        let patched: Record<string, unknown> = { ...next };
        for (const { stat, mode, perLevel } of ladder.effects) {
            const base = next[stat];
            if (typeof base !== 'number') continue;
            const raw = mode === 'mul' ? base * Math.pow(perLevel, level) : base + perLevel * level;
            patched[stat] = clampStat(stat, raw);
        }
        next = patched as unknown as CharacterSpec;
    }
    return next;
}