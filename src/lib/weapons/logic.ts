/**
 * src/lib/weapons/logic.ts
 * --------------------------------------------------------------------------
 * Pure predicates over a `WeaponSpec`. No Phaser, no DOM: the YAML guards
 * and the runtime both need to answer the same question about a weapon, and
 * that answer should only be written down once.
 */

import type { WeaponSpec } from './types';

/**
 * True when the weapon is melee rather than ranged.
 *
 * The schema defines melee as `hitWidth` + `hitHeight` with no `projectile`
 * (`WeaponSpecSchema.superRefine`), so the hitbox fields are the source of
 * truth. `bullet.type === 'melee'` counts as well, because the runtime has
 * always read it as the melee marker when it renders the swing arc.
 *
 * Melee weapons carry no ammo: the controller reports a single, never
 * reloading round for them (see `src/game/weapons/logic.ts`). That is why
 * `clipSize` / `reloadTimeMs` on a melee spec is a data mistake rather than
 * a style choice.
 */
export function isMeleeWeapon(spec: WeaponSpec): boolean {
    return (
        spec.hitWidth !== undefined ||
        spec.hitHeight !== undefined ||
        spec.bullet?.type === 'melee'
    );
}