import { describe, expect, it } from 'vitest';

import { tilemapResourcesFor } from '@/lib/tilemaps/resources';

const TILEMAP = {
    map: 'assets/tilemaps/beach-holiday-tiles.json',
    tileset: 'assets/image/tilesets/beach-holiday-tiles.png',
};

describe('tilemapResourcesFor', () => {
    it('namespaces both cache keys with the level id', () => {
        expect(tilemapResourcesFor('beach-holiday', TILEMAP)).toEqual({
            mapKey: 'tilemap:beach-holiday',
            mapPath: 'assets/tilemaps/beach-holiday-tiles.json',
            atlasKey: 'tileset:beach-holiday',
            atlasPath: 'assets/image/tilesets/beach-holiday-tiles.png',
        });
    });

    it('keeps two levels apart even when they share paths', () => {
        // Phaser's caches are game-wide: without the id, the second level
        // would draw the first level's map.
        const first = tilemapResourcesFor('sunlit-henge', TILEMAP);
        const second = tilemapResourcesFor('beach-holiday', TILEMAP);
        expect(first.mapKey).not.toBe(second.mapKey);
        expect(first.atlasKey).not.toBe(second.atlasKey);
    });

    it('passes the declared paths through untouched', () => {
        const resources = tilemapResourcesFor('x', TILEMAP);
        expect(resources.mapPath).toBe(TILEMAP.map);
        expect(resources.atlasPath).toBe(TILEMAP.tileset);
    });
});