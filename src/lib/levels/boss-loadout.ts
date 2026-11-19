/**
 * src/lib/levels/boss-loadout.ts
 * --------------------------------------------------------------------------
 * What the player is handed when they walk into the final fight.
 *
 * The owner: `其他人物打boss关时自动切换鲸鱼娘，鲸鱼娘除了自带的两种武器还要自动带上一把突击步枪，
 * 鲸鱼娘的武器和面板要全部是满级状态的，宠物buff的话跟随实际状态，有鲸鲸桌宠就加上，没有的话就用
 * 普通的满级面板打`.
 *
 * Three separate rules, all pure so they can be read without a scene:
 *   - the character is forced (that part is the level YAML's `character:` field),
 *   - the panel is maxed: every tavern ladder at its top rung,
 *   - the hotbar is maxed and carries one extra assault rifle,
 *   - the pet tier is left alone - `applyPetBonus` already follows whether the pet is running.
 */

import type { CharacterSpec } from '@/lib/characters';
import type { WeaponSpec } from '@/lib/weapons';
import { maxWeaponUpgradeLevel } from '@/lib/weapons/upgrades';
import { reserveMaxFor } from '@/lib/weapons/ammo';

/** The gun the boss level adds on top of whatever she already carries. */
export const BOSS_EXTRA_WEAPON_ID = 'assault-rifle';

/** Every tavern ladder at its top rung: `{ armor: 5, agility: 5, hp: 5, … }`. */
export function maxedUpgradeLevels(spec: CharacterSpec): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, ladder] of Object.entries(spec.upgrades ?? {})) {
        out[id] = ladder.costs.length;
    }
    return out;
}

/** The given weapons at their top rung: `{ 'whale-cannon': 4, … }`. */
export function maxedWeaponLevels(
    weaponIds: readonly string[],
    weaponsById: ReadonlyMap<string, WeaponSpec>,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of weaponIds) {
        const spec = weaponsById.get(id);
        if (!spec) continue;
        out[id] = maxWeaponUpgradeLevel(spec);
    }
    return out;
}

/**
 * Fold the boss level's maxed levels into whatever the player already owns.
 *
 * 主人实测（2026-11-14）：`我已经把boss关通了，通过seed传送过来的，然后打完点开神秘商人发现
 * 枪械等级有丢的`。 Entering the fight used to **replace** the whole ledger with the boss
 * loadout's map, so every gun the player had bought - 秘法法杖 / 纳什之牙 / 白龙獠牙 - dropped out
 * of it at the door. One missed restore (a refresh, a seed teleport, and the backup is only in
 * memory) and the levels were gone for good, because a later duplicate pickup then merged from
 * `0 + 1`.
 *
 * So the boss level only **adds** its own rows. Anything it does not carry is left alone.
 */
export function mergeBossWeaponLevels(
    owned: Readonly<Record<string, number>>,
    maxed: Readonly<Record<string, number>>,
): Record<string, number> {
    return { ...owned, ...maxed };
}

/** Her hotbar plus the boss level's extra rifle, without duplicates. */
export function bossHotbar(hotbar: readonly string[], extra = BOSS_EXTRA_WEAPON_ID): string[] {
    return hotbar.includes(extra) ? [...hotbar] : [...hotbar, extra];
}

/**
 * The store slot for a weapon she is handed at full strength: full magazine, full reserve.
 * Null when the weapon spec is missing (nothing to hand over).
 */
export function fullWeaponSlot(
    weaponId: string,
    weaponsById: ReadonlyMap<string, WeaponSpec>,
    level: number,
    name: (spec: WeaponSpec) => string,
): { id: string; name: string; ammo: number; clipSize: number; reserve: number } | null {
    const spec = weaponsById.get(weaponId);
    if (!spec) return null;
    const clipSize = spec.clipSize ?? 1;
    return {
        id: weaponId,
        name: name(spec),
        ammo: clipSize,
        clipSize,
        reserve: reserveMaxFor(clipSize, level),
    };
}
