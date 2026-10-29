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