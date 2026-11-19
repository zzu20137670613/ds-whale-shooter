import { describe, expect, it } from 'vitest';

import { atlasLayoutFor, tileGridFor } from '@/lib/tilemaps/grid';
import { FIRST_GID, buildTiledMap, sequentialGids } from '@/lib/tilemaps/tiled-map';

const GRID = tileGridFor(128, 128, 64); // 2x2 tiles
const ATLAS = atlasLayoutFor(4, 64, 64);

function build() {
    return buildTiledMap({
        grid: GRID,
        atlas: ATLAS,
        atlasImage: 'assets/image/tilesets/demo.png',
        tilesetName: 'demo-tiles',
        layers: [{ name: 'ground', data: [1, 2, 3, 4] }],
    });
}

describe('buildTiledMap', () => {
    it('writes the exact structure Phaser v4 parses', () => {
        // Pinned field by field on purpose: Phaser reads these names verbatim
        // (see the module header) and a rename fails silently at runtime.
        expect(build()).toEqual({
            type: 'map',
            version: 1.1,
            orientation: 'orthogonal',
            renderorder: 'right-down',
            infinite: false,
            width: 2,
            height: 2,
            tilewidth: 64,
            tileheight: 64,
            layers: [
                {
                    type: 'tilelayer',
                    name: 'ground',
                    width: 2,
                    height: 2,
                    x: 0,
                    y: 0,
                    opacity: 1,
                    visible: true,
                    data: [1, 2, 3, 4],
                },
            ],
            tilesets: [
                {
                    name: 'demo-tiles',
                    firstgid: 1,
                    tilewidth: 64,
                    tileheight: 64,
                    margin: 0,
                    spacing: 0,
                    columns: 4,
                    tilecount: 4,
                    image: 'assets/image/tilesets/demo.png',
                    imagewidth: 256,
                    imageheight: 64,
                },
            ],
        });
    });

    it('reports the atlas size, which is how Phaser derives the frames', () => {
        // ParseTilesets calls updateTileData(imagewidth, imageheight) and
        // ignores columns/tilecount — so these two must match the PNG.
        const map = build();
        expect(map.tilesets[0].imagewidth).toBe(ATLAS.width);
        expect(map.tilesets[0].imageheight).toBe(ATLAS.height);
    });

    it('keeps map size and tile size in sync with the grid', () => {
        const map = build();
        expect([map.width, map.height]).toEqual([GRID.cols, GRID.rows]);
        expect([map.tilewidth, map.tileheight]).toEqual([64, 64]);
    });

    it('refuses a layer whose data does not fill the grid', () => {
        expect(() =>
            buildTiledMap({
                grid: GRID,
                atlas: ATLAS,
                atlasImage: 'x.png',
                tilesetName: 'x',
                layers: [{ name: 'ground', data: [1, 2, 3] }],
            }),
        ).toThrow(/has 3 cells, expected 4/);
    });

    it('copies layer data instead of aliasing the caller array', () => {
        const data = [1, 2, 3, 4];
        const map = buildTiledMap({
            grid: GRID,
            atlas: ATLAS,
            atlasImage: 'x.png',
            tilesetName: 'x',
            layers: [{ name: 'ground', data }],
        });
        data[0] = 99;
        expect(map.layers[0].data[0]).toBe(1);
    });
});

describe('sequentialGids', () => {
    it('is the identity layout that puts a slice back down unchanged', () => {
        // Atlas order is source order and map order is row-major, so a trial
        // map that reproduces the source image is literally gids 1..N.
        expect(sequentialGids(4)).toEqual([1, 2, 3, 4]);
        expect(FIRST_GID).toBe(1);
    });

    it('counts the whole beach slice', () => {
        const grid = tileGridFor(2752, 1536, 64);
        expect(sequentialGids(grid.cols * grid.rows)).toHaveLength(43 * 24);
        expect(sequentialGids(grid.cols * grid.rows)[43 * 24 - 1]).toBe(43 * 24);
    });
});