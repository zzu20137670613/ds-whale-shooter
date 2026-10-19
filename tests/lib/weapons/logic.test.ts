/**
 * tests/lib/weapons/logic.test.ts
 * --------------------------------------------------------------------------
 * `isMeleeWeapon` is the one predicate that answers "is this weapon melee?".
 * The data guards ("every character starts with one melee and one ranged")
 * and the runtime both read it, so the cases here pin the schema's own
 * definition: melee carries a hitbox (`hitWidth` + `hitHeight`) and no
 * `projectile`; ranged is the other way round.
 *
 * Specs go through the REAL parser so a fixture cannot drift into a shape
 * the schema would reject.
 */
import { describe, expect, it } from 'vitest';

import type { WeaponSpec } from '@/lib/weapons';
import { isMeleeWeapon } from '@/lib/weapons/logic';
import { parseWeaponYaml } from '@/lib/weapons/parser';

/** Melee: a hitbox, no projectile — the schema's `hasMelee` branch. */
const melee = (extra = ''): WeaponSpec =>
    parseWeaponYaml(
        `
name: Test Melee
damage: 10
cooldownMs: 400
range: 180
hitWidth: 120
hitHeight: 120
${extra}`,
        'test-melee',
    );

/** Ranged: a projectile, no hitbox — the schema's other branch. */
const ranged = (): WeaponSpec =>
    parseWeaponYaml(
        `
name: Test Ranged
damage: 10
cooldownMs: 400
range: 500
projectile:
    speed: 20
    visual: { radius: 4, width: 8, height: 4, color: 1 }
`,
        'test-ranged',
    );

describe('isMeleeWeapon', () => {
    it('is true for a spec that carries a melee hitbox', () => {
        expect(isMeleeWeapon(melee())).toBe(true);
    });

    it('is true when the paired bullet is typed melee', () => {
        expect(isMeleeWeapon(melee('bullet:\n    type: melee\n'))).toBe(true);
    });

    it('is false for a projectile spec', () => {
        expect(isMeleeWeapon(ranged())).toBe(false);
    });
});