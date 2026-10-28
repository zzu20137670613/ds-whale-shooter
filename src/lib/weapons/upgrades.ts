/**
 * src/lib/weapons/upgrades.ts
 * --------------------------------------------------------------------------
 * Pure weapon-upgrade and ammo pricing math. No Phaser, no store, no I/O.
 *
 * ── Where the effect lands ─────────────────────────────────────────────
 * `applyWeaponUpgrade` rewrites a WeaponSpec's `damage`, and it is called
 * once per player weapon right after `resolve-scene.ts` builds
 * `weaponsById`. Every downstream consumer reads damage off that spec —
 * `weapons/logic.ts` stamps `slot.spec.damage` onto each bullet, and
 * `scene.ts` falls back to `active.damage` — so one remap makes the
 * upgrade real without touching the firing code. Monster weapons are
 * deliberately excluded at the call site: only the player's own weapons
 * are on the ledger.
 *
 * Ladders live in each weapon's YAML (`upgrades:`), so prices and the
 * damage multiplier are content, not code.
 */

import type { WeaponSpec } from './types';
import { reserveMaxFor } from './ammo';
import { isRangedWeapon, rangeAtLevel } from './range';

/** Price charged per missing round when refilling the hotbar.
 *
 *  Exported and named rather than inlined so the refill price has exactly
 *  one home: if it ever needs to vary per weapon or per level it moves to
 *  the weapon YAML next to the rest of the shop's economics. */
export const AMMO_REFILL_PRICE_PER_ROUND = 2;

/** Ladder length = its max level. 0 when the weapon is not upgradeable. */
export function maxWeaponUpgradeLevel(spec: WeaponSpec): number {
    return spec.upgrades?.costs.length ?? 0;
}

/**
 * Price of the next level, or `null` when the ladder is maxed or the
 * weapon has no ladder. `currentLevel` is how many levels are owned, so
 * the next price is `costs[currentLevel]`.
 */
export function weaponUpgradeCost(spec: WeaponSpec, currentLevel: number): number | null {
    const ladder = spec.upgrades;
    if (!ladder) return null;
    const level = clampLevel(currentLevel, ladder.costs.length);
    if (level >= ladder.costs.length) return null;
    return ladder.costs[level];
}

/**
 * Return a copy of `spec` with `level` upgrades applied to its damage.
 *
 * Damage compounds (`1.15` over 2 levels = 1.15²) and is rounded to an
 * integer with a floor of 1, because the rest of the game's damage numbers
 * are integers and a 0-damage weapon would silently never kill anything.
 * A weapon with no ladder, or level 0, comes back untouched (same object).
 */
export function applyWeaponUpgrade(spec: WeaponSpec, level: number): WeaponSpec {
    const ladder = spec.upgrades;
    if (!ladder) return spec;
    const lv = clampLevel(level, ladder.costs.length);
    if (lv === 0) return spec;
    const damage = ladder.damagePerLevel
        ? // Explicit table: the YAML number IS the number the game uses. No
          // rounding, so no level can silently buy nothing.
          Math.max(1, Math.round(ladder.damagePerLevel[lv] ?? spec.damage))
        : Math.max(1, Math.round(spec.damage * Math.pow(ladder.damageMulPerLevel ?? 1, lv)));

    // Ranged weapons also reach further: the boss fights are kiting fights, and a
    // reach that never moves would leave the hardest fight fought at starting
    // distance. Melee keeps its `range`, which positions the swing hitbox.
    const range = isRangedWeapon(spec) ? Math.round(rangeAtLevel(spec.range, lv)) : spec.range;

    return { ...spec, damage, range };
}

/**
 * What a full hotbar refill costs: every missing round, at
 * `AMMO_REFILL_PRICE_PER_ROUND`. Already-full slots cost nothing, so a
 * player who just reloaded is not charged twice.
 */
/** Coins one refill costs, per slot, given that weapon's `ammoPrice`. */
export function ammoPriceForSlot(
    slot: { reserve?: number; clipSize: number; level?: number; ammoPrice?: { price: number; perRounds: number } },
): number {
    const missing = Math.max(
        0,
        reserveMaxFor(slot.clipSize, slot.level ?? 0) - Math.floor(slot.reserve ?? 0),
    );
    if (missing === 0) return 0;
    const price = slot.ammoPrice?.price ?? AMMO_REFILL_PRICE_PER_ROUND;
    const perRounds = slot.ammoPrice?.perRounds ?? 1;
    // Whole coins only: 1 coin per 3 rounds means 4 missing rounds cost 2.
    return Math.ceil(missing / perRounds) * price;
}

/** What refilling the whole hotbar costs. */
export function ammoRefillPrice(
    slots: ReadonlyArray<{
        reserve?: number;
        clipSize: number;
        level?: number;
        ammoPrice?: { price: number; perRounds: number };
    }>,
): number {
    return slots.reduce((sum, slot) => sum + ammoPriceForSlot(slot), 0);
}

function clampLevel(level: number, ladderLength: number): number {
    if (!Number.isFinite(level)) return 0;
    return Math.max(0, Math.min(ladderLength, Math.floor(level)));
}
