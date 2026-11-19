/**
 * tests/lib/characters/restored-weapons.test.ts
 * --------------------------------------------------------------------------
 * Walking back into a level is not starting a new run.
 *
 * The cat's assault rifle vanished the moment the player stepped back into 海边亭台: the tavern
 * rebuilt the character from her YAML hotbar, which knows nothing about pickups. The store's
 * slots are what she actually carries; the hotbar is only the fallback for a save with none.
 */

import { describe, expect, it } from 'vitest';

import { restoredWeaponsFor, startingWeaponsFor } from '@/lib/characters/starting-weapons';
import type { CharacterSpec } from '@/lib/characters';
import type { WeaponSpec } from '@/lib/weapons';

const gun = (id: string) => ({ id }) as unknown as WeaponSpec;

const weapons = new Map<string, WeaponSpec>([
    ['nashors-tooth', gun('nashors-tooth')],
    ['white-dragon-fangs', gun('white-dragon-fangs')],
    ['assault-rifle', gun('assault-rifle')],
    ['frostmourne', gun('frostmourne')],
]);

const gpt = {
    hotbar: ['nashors-tooth', 'white-dragon-fangs'],
    weaponMax: 4,
} as unknown as CharacterSpec;

describe('restoredWeaponsFor', () => {
    it('brings back the guns she was carrying, including pickups', () => {
        const got = restoredWeaponsFor(
            gpt,
            weapons,
            [{ id: 'nashors-tooth' }, { id: 'white-dragon-fangs' }, { id: 'assault-rifle' }],
        );
        expect(got.map((w) => w.id)).toEqual([
            'nashors-tooth',
            'white-dragon-fangs',
            'assault-rifle',
        ]);
    });

    it('falls back to her hotbar when nothing was saved', () => {
        expect(restoredWeaponsFor(gpt, weapons, []).map((w) => w.id)).toEqual(
            startingWeaponsFor(gpt, weapons).map((w) => w.id),
        );
        expect(restoredWeaponsFor(gpt, weapons, undefined).map((w) => w.id)).toEqual([
            'nashors-tooth',
            'white-dragon-fangs',
        ]);
    });

    it('drops ids the scene never loaded instead of throwing', () => {
        const got = restoredWeaponsFor(gpt, weapons, [{ id: 'gone' }, { id: 'assault-rifle' }]);
        expect(got.map((w) => w.id)).toEqual(['assault-rifle']);
    });

    it('never restores the same gun twice', () => {
        const got = restoredWeaponsFor(gpt, weapons, [{ id: 'assault-rifle' }, { id: 'assault-rifle' }]);
        expect(got).toHaveLength(1);
    });

    it('respects her weaponMax', () => {
        const tight = { hotbar: [], weaponMax: 2 } as unknown as CharacterSpec;
        const got = restoredWeaponsFor(
            tight,
            weapons,
            [{ id: 'assault-rifle' }, { id: 'frostmourne' }, { id: 'nashors-tooth' }],
        );
        expect(got).toHaveLength(2);
    });
});