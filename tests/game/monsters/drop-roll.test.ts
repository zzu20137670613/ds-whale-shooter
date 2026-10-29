/**
 * tests/game/monsters/drop-roll.test.ts
 * --------------------------------------------------------------------------
 * Rolling a monster's drop table, including the 数量 column.
 *
 * Each row is one independent roll (`chance`), and `amount` copies of a successful
 * row become separate pickups. The table's 数量 is 1 everywhere today, but the column
 * exists and the schema honours it, so a "3 fragments" row cannot silently do nothing
 * when the owner fills one in.
 */

import { describe, expect, it } from 'vitest';

import { rollDrops } from '@/game/monsters/logic';
import type { DropRef } from '@/lib/monsters';

const byId = (id: string) => ({ id });

describe('rollDrops', () => {
    it('always yields a 100% row', () => {
        const table: DropRef[] = [{ dropId: 'hp-shard', chance: 1, amount: 1 }];
        expect(rollDrops(table, byId)).toHaveLength(1);
    });

    it('never yields a 0% row', () => {
        const table: DropRef[] = [{ dropId: 'hp-shard', chance: 0, amount: 1 }];
        expect(rollDrops(table, byId)).toHaveLength(0);
    });

    it('scatters amount copies as separate pickups', () => {
        const table: DropRef[] = [{ dropId: 'ammo-cache', chance: 1, amount: 3 }];
        const rolled = rollDrops(table, byId);
        expect(rolled).toHaveLength(3);
        expect(rolled.every((drop) => drop.dropId === 'ammo-cache')).toBe(true);
    });

    it('rolls each row independently', () => {
        // One guaranteed row and one impossible row: exactly one drop, never two.
        const table: DropRef[] = [
            { dropId: 'hp-shard', chance: 1, amount: 1 },
            { dropId: 'barnacle', chance: 0, amount: 1 },
        ];
        const rolled = rollDrops(table, byId);
        expect(rolled.map((drop) => drop.dropId)).toEqual(['hp-shard']);
    });

    it('resolves each drop through the lookup it is given', () => {
        const table: DropRef[] = [{ dropId: 'hp-shard', chance: 1, amount: 1 }];
        expect(rollDrops(table, byId)[0].spec).toEqual({ id: 'hp-shard' });
    });
});