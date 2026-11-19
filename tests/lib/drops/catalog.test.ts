/**
 * tests/lib/drops/catalog.test.ts
 * --------------------------------------------------------------------------
 * The bag outlives a scene, so its catalog has to as well.
 *
 * The bug: `iced-juice` picked up on the beach showed as `目录缺失: iced-juice` after
 * moving on, because the catalog was rebuilt per scene from that scene's drop ids.
 */

import { describe, expect, it } from 'vitest';

import { mergeDropCatalog } from '@/lib/drops/catalog';
import type { DropCatalogEntry } from '@/store/game-store';

const entry = (name: string): DropCatalogEntry => ({
    name,
    nameZh: name,
    usable: true,
    sellPrice: 1,
    tint: 0xffffff,
});

describe('mergeDropCatalog', () => {
    it('keeps an item from the previous scene instead of dropping it', () => {
        const merged = mergeDropCatalog(
            { 'iced-juice': entry('Iced Juice') },
            { 'hp-shard': entry('HP Shard') },
        );
        expect(Object.keys(merged).sort()).toEqual(['hp-shard', 'iced-juice']);
    });

    it('lets fresh data win for the ids it carries', () => {
        const merged = mergeDropCatalog(
            { 'hp-shard': { ...entry('Old'), sellPrice: 1 } },
            { 'hp-shard': { ...entry('New'), sellPrice: 9 } },
        );
        expect(merged['hp-shard'].name).toBe('New');
        expect(merged['hp-shard'].sellPrice).toBe(9);
    });

    it('is a no-op when the scene resolved nothing new', () => {
        const current = { 'hp-shard': entry('HP Shard') };
        expect(mergeDropCatalog(current, {})).toEqual(current);
    });

    it('does not mutate the catalog it was given', () => {
        const current = { 'hp-shard': entry('HP Shard') };
        mergeDropCatalog(current, { 'iced-juice': entry('Iced Juice') });
        expect(Object.keys(current)).toEqual(['hp-shard']);
    });
});