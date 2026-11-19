/**
 * src/lib/characters/starting-weapons.ts
 * --------------------------------------------------------------------------
 * The weapons a character starts a run with.
 *
 * Resolved from HER OWN `hotbar`, never from the scene's weapon list. That list belongs
 * to whichever character the LEVEL was resolved for - the tavern's default girl - so
 * handing it to whoever the player picked gave GPT the whale cannon. That is exactly
 * the bug the owner hit by restarting and choosing GPT.
 */

import type { CharacterSpec } from '@/lib/characters/types';
import type { WeaponSpec } from '@/lib/weapons';

/**
 * Resolve a spec's hotbar ids against the scene's weapon lookup.
 *
 * Unknown ids are dropped rather than throwing: a save or a spec may name a weapon a
 * data edit removed, and starting with one gun fewer beats refusing to spawn.
 */
export function startingWeaponsFor(
    spec: Pick<CharacterSpec, 'hotbar'>,
    weaponsById: ReadonlyMap<string, WeaponSpec>,
): WeaponSpec[] {
    const resolved: WeaponSpec[] = [];
    for (const id of spec.hotbar ?? []) {
        const weapon = weaponsById.get(id);
        if (weapon) resolved.push(weapon);
    }
    return resolved;
}

/**
 * The weapons to spawn with when the player walks BACK into a level, not when a run starts.
 *
 * Re-entering the tavern used to hand her the YAML hotbar again, which quietly deleted every
 * pickup of the run: the cat's assault rifle vanished the moment the player stepped back into
 * 海边亭台. The persisted slots are the truth there, capped by her `weaponMax`; the YAML
 * hotbar is only the fallback for a save that has none.
 */
export function restoredWeaponsFor(
    spec: Pick<CharacterSpec, 'hotbar' | 'weaponMax'>,
    weaponsById: ReadonlyMap<string, WeaponSpec>,
    savedSlots: readonly { id: string }[] | undefined,
): WeaponSpec[] {
    const restored: WeaponSpec[] = [];
    for (const slot of savedSlots ?? []) {
        const weapon = weaponsById.get(slot.id);
        if (weapon && !restored.some((w) => w.id === weapon.id)) restored.push(weapon);
    }
    if (restored.length === 0) return startingWeaponsFor(spec, weaponsById);
    const cap = spec.weaponMax ?? restored.length;
    return restored.slice(0, cap);
}
