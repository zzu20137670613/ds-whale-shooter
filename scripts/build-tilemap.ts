/**
 * scripts/build-tilemap.ts
 * --------------------------------------------------------------------------
 * Write the Tiled JSON for a sliced tileset. `scripts/slice-tileset.py`
 * produces the atlas PNG; this produces the map that places it, through the
 * pure builders in `lib/tilemaps` so the format is defined in exactly one
 * place.
 *
 * Usage:
 *   pnpm tsx scripts/build-tilemap.ts <cols> <rows> <tile> <atlasColumns> <name>
 * Reads:
 *   public/assets/image/tilesets/<name>.png   (the atlas, from slice-tileset.py)
 * Writes:
 *   public/assets/tilemaps/<name>.json
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { atlasLayoutFor, tileGridFor } from '@/lib/tilemaps/grid';
import { buildTiledMap, sequentialGids } from '@/lib/tilemaps/tiled-map';

const USAGE = 'usage: pnpm tsx scripts/build-tilemap.ts <cols> <rows> <tile> <atlasColumns> <name>';

const [colsArg, rowsArg, tileArg, atlasColumnsArg, name] = process.argv.slice(2);
const sizes = [colsArg, rowsArg, tileArg, atlasColumnsArg].map(Number);

if (!name || sizes.some((value) => !Number.isInteger(value) || value <= 0)) {
    console.error(USAGE);
    process.exit(1);
}

const [cols, rows, tile, atlasColumns] = sizes;

const grid = tileGridFor(cols * tile, rows * tile, tile);
const tileCount = grid.cols * grid.rows;
const atlas = atlasLayoutFor(tileCount, tile, atlasColumns);

const map = buildTiledMap({
    grid,
    atlas,
    atlasImage: `assets/image/tilesets/${name}.png`,
    tilesetName: name,
    // The atlas keeps the source image's row-major order, so laying the source
    // image back down is gids 1..N with nothing else to remember.
    layers: [{ name: 'ground', data: sequentialGids(tileCount) }],
});

const outPath = join('public', 'assets', 'tilemaps', `${name}.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');

console.log(`map    ${grid.cols}x${grid.rows} tiles of ${tile}px = ${cols * tile}x${rows * tile}px`);
console.log(`atlas  ${atlas.cols}x${atlas.rows} frames = ${atlas.width}x${atlas.height}px`);
console.log(`gids   1..${tileCount}`);
console.log(`wrote  ${outPath}`);