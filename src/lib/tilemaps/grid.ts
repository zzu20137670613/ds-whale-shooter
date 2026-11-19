/**
 * src/lib/tilemaps/grid.ts
 * --------------------------------------------------------------------------
 * Grid arithmetic for slicing a painted scene into tiles and packing those
 * tiles into one atlas. Pure — no Phaser, no IO — so both the tooling under
 * `scripts/` and the tests drive the same numbers.
 */

/** A tile grid that covers an image exactly. */
export interface TileGrid {
    cols: number;
    rows: number;
    tileSize: number;
}

/** A single-image tileset laid out as a uniform grid of tiles. */
export interface AtlasLayout {
    cols: number;
    rows: number;
    width: number;
    height: number;
    tileSize: number;
}

/**
 * The grid covering `width x height` in whole tiles.
 *
 * Throws when the tile size divides neither axis: a partially covered edge
 * would shift every tile after it, which is exactly the class of mistake
 * that should never make it as far as a PNG.
 */
export function tileGridFor(width: number, height: number, tileSize: number): TileGrid {
    if (!Number.isInteger(tileSize) || tileSize <= 0) {
        throw new Error(`tileSize must be a positive integer, got ${tileSize}`);
    }
    if (width % tileSize !== 0 || height % tileSize !== 0) {
        throw new Error(
            `${width}x${height} is not a whole number of ${tileSize}px tiles ` +
                `(${width / tileSize} x ${height / tileSize})`,
        );
    }
    return { cols: width / tileSize, rows: height / tileSize, tileSize };
}

/** Unique tile count a slice of this grid produces. */
export function tileCountOf(grid: TileGrid): number {
    return grid.cols * grid.rows;
}

/**
 * Where each tile of a slice lands in the packed atlas. Tiles keep the source
 * image's row-major order, so frame `i` is source tile `i` — and a map that
 * places the source image back down is simply gids `1..N` in order.
 *
 * `maxColumns` caps the width; the height grows to whatever the tiles need.
 * The result is not forced to power-of-two dimensions: Phaser draws tiles
 * with clamped sampling and no mipmaps, where non-power-of-two is fine.
 */
export function atlasLayoutFor(
    tileCount: number,
    tileSize: number,
    maxColumns: number,
): AtlasLayout {
    if (tileCount <= 0) throw new Error(`tileCount must be positive, got ${tileCount}`);
    if (!Number.isInteger(tileSize) || tileSize <= 0) {
        throw new Error(`tileSize must be a positive integer, got ${tileSize}`);
    }
    if (!Number.isInteger(maxColumns) || maxColumns <= 0) {
        throw new Error(`maxColumns must be a positive integer, got ${maxColumns}`);
    }
    const cols = Math.min(tileCount, maxColumns);
    const rows = Math.ceil(tileCount / cols);
    return { cols, rows, width: cols * tileSize, height: rows * tileSize, tileSize };
}