/**
 * tests/game/monsters/drop-roll.test.ts
 * --------------------------------------------------------------------------
 * Rolling a monster's drop table, now with the three payout tiers the design table
 * uses: 藤壶 "100% one, 50% two, 20% three".
 *
 * The tiers NEST. A three-hit eats the two and the one, which is what the owner means
 * by "50% 掉两个" - not "one plus another, sometimes". The tests below pin that down,
 * because a naive implementation (three independent rolls) produces a very different
 * distribution while looking almost the same in the table.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { rollDrops } from '@/game/monsters/logic';

const byId = (id: string) => ({ id });

afterEach(() => {
    vi.restoreAllMocks();
});

/** Force the roll to a fixed value for the next call. */
function withRoll(value: number) {
    vi.spyOn(Math, 'random').mockReturnValue(value);
}

describe('rollDrops', () => {
    it('always yields a guaranteed one-copy row', () => {
        withRoll(0.99);
        expect(rollDrops([{ dropId: 'hp-shard', chance: 1 }], byId)).toHaveLength(1);
    });

    it('never yields a 0% row', () => {
        withRoll(0.5);
        expect(rollDrops([{ dropId: 'hp-shard', chance: 0 }], byId)).toHaveLength(0);
    });

    it('pays three inside the top tier', () => {
        withRoll(0.1);
        const table = [{ dropId: 'barnacle', chance: 1, chance2: 0.5, chance3: 0.2 }];
        const rolled = rollDrops(table, byId);
        expect(rolled).toHaveLength(3);
        expect(rolled.every((drop) => drop.dropId === 'barnacle')).toBe(true);
    });

    it('pays two inside the middle tier', () => {
        withRoll(0.35);
        const table = [{ dropId: 'barnacle', chance: 1, chance2: 0.5, chance3: 0.2 }];
        expect(rollDrops(table, byId)).toHaveLength(2);
    });

    it('pays one between the middle tier and the guaranteed row', () => {
        withRoll(0.8);
        const table = [{ dropId: 'barnacle', chance: 1, chance2: 0.5, chance3: 0.2 }];
        expect(rollDrops(table, byId)).toHaveLength(1);
    });

    it('pays nothing past the last tier', () => {
        withRoll(0.9);
        const table = [{ dropId: 'barnacle', chance: 0.5, chance2: 0.3, chance3: 0.1 }];
        expect(rollDrops(table, byId)).toHaveLength(0);
    });

    it('treats a missing middle tier as closed, not as a hole', () => {
        // chance 1, chance3 0.2, no chance2: a 0.5 roll must pay ONE, not two.
        withRoll(0.5);
        const table = [{ dropId: 'hp-shard', chance: 1, chance3: 0.2 }];
        expect(rollDrops(table, byId)).toHaveLength(1);
    });

    it('rolls each row independently', () => {
        withRoll(0.95);
        const table = [
            { dropId: 'hp-shard', chance: 1 },
            { dropId: 'overcharge-core', chance: 0.1 },
        ];
        expect(rollDrops(table, byId).map((drop) => drop.dropId)).toEqual(['hp-shard']);
    });

    it('resolves each drop through the lookup it is given', () => {
        withRoll(0);
        const table = [{ dropId: 'hp-shard', chance: 1 }];
        expect(rollDrops(table, byId)[0].spec).toEqual({ id: 'hp-shard' });
    });
});

describe('the tier mix the owner described', () => {
    it('pays 1 / 2 / 3 at 50% / 30% / 20% for 藤壶', () => {
        // 100% one, 50% two, 20% three -> out of 1000 draws:
        //   3 copies for the lowest 200 (chance3)
        //   2 copies for 200..500 (chance2)
        //   1 copy  for 500..1000 (chance)
        const table = [{ dropId: 'barnacle', chance: 1, chance2: 0.5, chance3: 0.2 }];
        const counts = { 1: 0, 2: 0, 3: 0 };

        for (let i = 0; i < 1000; i += 1) {
            // A deterministic sweep over [0, 1) instead of relying on real randomness.
            vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / 1000);
            const size = rollDrops(table, byId).length;
            counts[size as 1 | 2 | 3] += 1;
            vi.restoreAllMocks();
        }

        expect(counts[3]).toBe(200);
        expect(counts[2]).toBe(300);
        expect(counts[1]).toBe(500);
    });
});