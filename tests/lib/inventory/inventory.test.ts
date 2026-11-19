/**
 * tests/lib/inventory/inventory.test.ts
 * --------------------------------------------------------------------------
 * Backpack arithmetic. 60 slots (10 wide x 6 tall), same item stacks to 30 per
 * slot, walk-over pickup, and a full bag must leave the item on the floor
 * rather than silently eating it.
 */

import { describe, expect, it } from 'vitest';

import {
    INVENTORY_SLOTS,
    INVENTORY_STACK_MAX,
    addToInventory,
    countOf,
    emptyInventory,
    findSlot,
    isPickupPossible,
    removeFromInventory,
} from '@/lib/inventory';
import type { InventorySlot } from '@/lib/inventory';

describe('geometry', () => {
    it('is a 10 x 6 grid', () => {
        expect(INVENTORY_SLOTS).toBe(60);
        expect(INVENTORY_STACK_MAX).toBe(30);
    });

    it('starts empty', () => {
        expect(emptyInventory()).toEqual([]);
    });
});

describe('addToInventory', () => {
    it('puts a new item in the first slot', () => {
        const result = addToInventory([], 'barnacle', 1);
        expect(result.slots).toEqual([{ dropId: 'barnacle', count: 1 }]);
        expect(result.added).toBe(1);
    });

    it('stacks the same item', () => {
        const result = addToInventory([{ dropId: 'barnacle', count: 1 }], 'barnacle', 2);
        expect(result.slots).toEqual([{ dropId: 'barnacle', count: 3 }]);
        expect(result.added).toBe(2);
    });

    it('stops a stack at 30 and opens a new slot', () => {
        const result = addToInventory([{ dropId: 'barnacle', count: 29 }], 'barnacle', 3);
        expect(result.slots).toEqual([
            { dropId: 'barnacle', count: 30 },
            { dropId: 'barnacle', count: 2 },
        ]);
        expect(result.added).toBe(3);
    });

    it('fills several partial stacks before opening a new slot', () => {
        const result = addToInventory(
            [
                { dropId: 'barnacle', count: 28 },
                { dropId: 'barnacle', count: 28 },
            ],
            'barnacle',
            5,
        );
        expect(result.slots).toEqual([
            { dropId: 'barnacle', count: 30 },
            { dropId: 'barnacle', count: 30 },
            { dropId: 'barnacle', count: 1 },
        ]);
    });

    it('keeps different items in different slots', () => {
        const result = addToInventory([{ dropId: 'barnacle', count: 1 }], 'hp-shard', 1);
        expect(result.slots).toHaveLength(2);
        expect(result.added).toBe(1);
    });

    it('accepts nothing when every slot is a full stack of something else', () => {
        const full: InventorySlot[] = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ({
            dropId: `item-${i}`,
            count: 1,
        }));
        const result = addToInventory(full, 'barnacle', 1);
        expect(result.added).toBe(0);
        expect(result.slots).toBe(full); // untouched, same reference
    });

    it('accepts a partial amount when the bag is nearly full', () => {
        // 59 full-ish slots plus one barnacle stack at 29: only 1 fits.
        const almost: InventorySlot[] = [
            ...Array.from({ length: 59 }, (_, i) => ({ dropId: `item-${i}`, count: 1 })),
            { dropId: 'barnacle', count: 29 },
        ];
        const result = addToInventory(almost, 'barnacle', 5);
        expect(result.added).toBe(1);
        expect(countOf(result.slots, 'barnacle')).toBe(30);
    });

    it('refuses a zero or negative pickup without touching the bag', () => {
        const bag: InventorySlot[] = [{ dropId: 'barnacle', count: 1 }];
        expect(addToInventory(bag, 'barnacle', 0)).toEqual({ slots: bag, added: 0 });
        expect(addToInventory(bag, 'barnacle', -3)).toEqual({ slots: bag, added: 0 });
    });
});

describe('isPickupPossible', () => {
    it('is true while a stack has room', () => {
        expect(isPickupPossible([{ dropId: 'barnacle', count: 29 }], 'barnacle')).toBe(true);
    });

    it('is false when the stack is capped and no slot is free', () => {
        const full: InventorySlot[] = Array.from({ length: INVENTORY_SLOTS }, () => ({
            dropId: 'barnacle',
            count: INVENTORY_STACK_MAX,
        }));
        expect(isPickupPossible(full, 'barnacle')).toBe(false);
    });

    it('is true for a new item while a slot is free', () => {
        expect(isPickupPossible([], 'hp-shard')).toBe(true);
    });
});

describe('removeFromInventory', () => {
    it('takes one off a stack', () => {
        expect(removeFromInventory([{ dropId: 'barnacle', count: 3 }], 0)).toEqual([
            { dropId: 'barnacle', count: 2 },
        ]);
    });

    it('drops the slot when it hits zero', () => {
        expect(removeFromInventory([{ dropId: 'barnacle', count: 1 }], 0)).toEqual([]);
    });

    it('ignores an out-of-range index', () => {
        const bag: InventorySlot[] = [{ dropId: 'barnacle', count: 1 }];
        expect(removeFromInventory(bag, 7)).toEqual(bag);
        expect(removeFromInventory(bag, -1)).toEqual(bag);
    });
});

describe('countOf / findSlot', () => {
    it('counts across stack boundaries', () => {
        const bag: InventorySlot[] = [
            { dropId: 'barnacle', count: 30 },
            { dropId: 'hp-shard', count: 2 },
            { dropId: 'barnacle', count: 4 },
        ];
        expect(countOf(bag, 'barnacle')).toBe(34);
        expect(countOf(bag, 'nope')).toBe(0);
    });

    it('finds the first slot holding an item', () => {
        const bag: InventorySlot[] = [
            { dropId: 'hp-shard', count: 1 },
            { dropId: 'barnacle', count: 1 },
        ];
        expect(findSlot(bag, 'barnacle')).toBe(1);
        expect(findSlot(bag, 'nope')).toBe(-1);
    });
});