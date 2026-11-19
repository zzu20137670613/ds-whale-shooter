/**
 * tests/lib/characters/starting-weapons.test.ts
 * --------------------------------------------------------------------------
 * A character starts with HER guns.
 *
 * The bug this pins down: the tavern confirm path passed the scene's weapon list (the
 * default girl's) to whoever was picked, so restarting as GPT spawned her holding the
 * whale cannon.
 */

import { describe, expect, it } from 'vitest';

import { startingWeaponsFor } from '@/lib/characters/starting-weapons';
import type { WeaponSpec } from '@/lib/weapons';

const fake = (id: string) => ({ id, name: id }) as unknown as WeaponSpec;

const lookup = new Map<string, WeaponSpec>([
    ['whale-cannon', fake('whale-cannon')],
    ['whale-tail-slam', fake('whale-tail-slam')],
    ['nashors-tooth', fake('nashors-tooth')],
    ['white-dragon-fangs', fake('white-dragon-fangs')],
]);

describe('startingWeaponsFor', () => {
    it('gives GPT her own pair, not DeepSeek\'s', () => {
        const weapons = startingWeaponsFor(
            { hotbar: ['nashors-tooth', 'white-dragon-fangs'] },
            lookup,
        );
        expect(weapons.map((weapon) => weapon.id)).toEqual([
            'nashors-tooth',
            'white-dragon-fangs',
        ]);
    });

    it('keeps the hotbar order, because slot 1 is the active weapon', () => {
        const weapons = startingWeaponsFor({ hotbar: ['white-dragon-fangs', 'nashors-tooth'] }, lookup);
        expect(weapons[0].id).toBe('white-dragon-fangs');
    });

    it('drops ids the lookup does not know instead of throwing', () => {
        const weapons = startingWeaponsFor({ hotbar: ['nashors-tooth', 'deleted-gun'] }, lookup);
        expect(weapons.map((weapon) => weapon.id)).toEqual(['nashors-tooth']);
    });

    it('returns nothing for an empty hotbar', () => {
        expect(startingWeaponsFor({ hotbar: [] }, lookup)).toEqual([]);
    });
});