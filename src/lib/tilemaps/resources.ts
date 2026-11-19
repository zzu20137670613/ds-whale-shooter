/**
 * src/lib/tilemaps/resources.ts
 * --------------------------------------------------------------------------
 * The Phaser cache keys and paths a level's tilemap needs.
 *
 * Keys are namespaced by level the same way the background texture is
 * (`background:<levelId>`). Phaser's TextureManager and tilemap cache are
 * game-wide, so a bare key would hand the next level this level's map or
 * atlas — the exact trap the background texture key already had to dodge.
 */

export interface TilemapResources {
    /** For `this.load.tilemapTiledJSON(key, path)`. */
    mapKey: string;
    mapPath: string;
    /** For `this.load.image(key, path)`. */
    atlasKey: string;
    atlasPath: string;
}

/** The `tilemap:` block of a level's YAML. */
export interface TilemapLevelFields {
    map: string;
    tileset: string;
}

export function tilemapResourcesFor(
    levelId: string,
    tilemap: TilemapLevelFields,
): TilemapResources {
    return {
        mapKey: `tilemap:${levelId}`,
        mapPath: tilemap.map,
        atlasKey: `tileset:${levelId}`,
        atlasPath: tilemap.tileset,
    };
}