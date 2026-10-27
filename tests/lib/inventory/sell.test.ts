/**
 * tests/lib/inventory/sell.test.ts
 * --------------------------------------------------------------------------
 * Selling back to the shop: the barnacle is worth a coin, the four original
 * pickups are worth nothing until the owner prices them.
 */

import { describe, expect, it } from 'vitest';

import { bagSellValue, sellListings } from '@/lib/inventory/sell';

const catalog = {
    barnacle: { name: 'Barnacle', sellPrice: 1 },
    'hp-shard': { name: 'HP Shard' },
    'ammo-cache': { name: 'Ammo Cache', sellPrice: 0 },
};

describe('sellListings', () => {
    it('merges stacks of the same item into one listing', () => {
        const listings = sellListings(
            [
                { dropId: 'barnacle', count: 30 },
                { dropId: 'barnacle', count: 4 },
            ],
            catalog,
        );
        expect(listings).toEqual([
            { dropId: 'barnacle', name: 'Barnacle', count: 34, unitPrice: 1, total: 34 },
        ]);
    });

    it('skips items the shop does not buy', () => {
        const listings = sellListings(
            [
                { dropId: 'hp-shard', count: 3 },
                { dropId: 'ammo-cache', count: 2 },
            ],
            catalog,
        );
        expect(listings).toEqual([]);
    });

    it('keeps the order items first appear in the bag', () => {
        const listings = sellListings(
            [
                { dropId: 'barnacle', count: 1 },
                { dropId: 'hp-shard', count: 1 },
                { dropId: 'barnacle', count: 1 },
            ],
            catalog,
        );
        expect(listings.map((l) => l.dropId)).toEqual(['barnacle']);
    });

    it('falls back to the id when the catalog has no entry', () => {
        const listings = sellListings([{ dropId: 'mystery', count: 1 }], {
            mystery: { name: 'Mystery', sellPrice: 5 },
        });
        expect(listings[0].name).toBe('Mystery');
        expect(sellListings([{ dropId: 'unknown', count: 1 }], {})).toEqual([]);
    });
});

describe('bagSellValue', () => {
    it('adds up every sellable unit', () => {
        expect(
            bagSellValue(
                [
                    { dropId: 'barnacle', count: 12 },
                    { dropId: 'hp-shard', count: 4 },
                ],
                catalog,
            ),
        ).toBe(12);
    });

    it('is zero for an empty or unsellable bag', () => {
        expect(bagSellValue([], catalog)).toBe(0);
        expect(bagSellValue([{ dropId: 'hp-shard', count: 9 }], catalog)).toBe(0);
    });
});