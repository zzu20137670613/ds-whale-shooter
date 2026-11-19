/**
 * src/lib/tilemaps/tiled-map.ts
 * --------------------------------------------------------------------------
 * Builds the Tiled-JSON map that Phaser's tilemap parser reads.
 *
 * The field names here are the parser's contract, not a style choice. Checked
 * against Phaser v4's own sources:
 *
 *   map     `tilemaps/parsers/tiled/ParseJSONTiled.js` reads width, height,
 *           tilewidth, tileheight, orientation, version, renderorder,
 *           infinite, layers and tilesets.
 *   tileset `ParseTilesets.js` reads name, firstgid, tilewidth, tileheight,
 *           margin, spacing and — for a sliced (single-image) tileset —
 *           imagewidth/imageheight, from which it derives the frame grid.
 *           `columns`/`tilecount` are informational to Phaser but Tiled needs
 *           them to open the file, so they are written anyway.
 *   layer   `ParseTileLayers.js` only handles `type: 'tilelayer'`; a plain
 *           `data` array skips the base64 decoder entirely.
 *
 * A plain array beats base64 here on purpose: it gzips well and stays
 * diffable in git.
 */

import type { AtlasLayout, TileGrid } from './grid';

/** One gid per cell, row-major. `0` means empty. */
export type TileLayerData = readonly number[];

export interface TiledLayer {
    type: 'tilelayer';
    name: string;
    width: number;
    height: number;
    x: number;
    y: number;
    opacity: number;
    visible: boolean;
    data: number[];
}

export interface TiledTileset {
    name: string;
    firstgid: number;
    tilewidth: number;
    tileheight: number;
    margin: number;
    spacing: number;
    columns: number;
    tilecount: number;
    image: string;
    imagewidth: number;
    imageheight: number;
}

export interface TiledMapJson {
    type: 'map';
    version: number;
    orientation: 'orthogonal';
    renderorder: 'right-down';
    infinite: false;
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers: TiledLayer[];
    tilesets: TiledTileset[];
}

export interface TiledMapInput {
    grid: TileGrid;
    atlas: AtlasLayout;
    /** Atlas path, written for Tiled's benefit — Phaser loads the image itself. */
    atlasImage: string;
    tilesetName: string;
    layers: { name: string; data: TileLayerData }[];
}

/** Tiled's first global id: tile index `i` (0-based, row-major) is gid `i + 1`. */
export const FIRST_GID = 1;

/**
 * Phaser gates its newer tileset parsing on `version > 1` and Tiled writes
 * `1.10` here. JSON cannot keep the trailing zero, so this is 1.1 — which
 * still compares greater than 1.
 */
export const TILED_VERSION = 1.1;

/** Gids for a layer that places an atlas' tiles in order — `1..tileCount`. */
export function sequentialGids(tileCount: number): number[] {
    return Array.from({ length: tileCount }, (_, index) => index + FIRST_GID);
}

export function buildTiledMap(input: TiledMapInput): TiledMapJson {
    const { grid, atlas } = input;
    const expected = grid.cols * grid.rows;

    const layers = input.layers.map((layer) => {
        if (layer.data.length !== expected) {
            throw new Error(
                `layer "${layer.name}" has ${layer.data.length} cells, expected ${expected} ` +
                    `(${grid.cols}x${grid.rows})`,
            );
        }
        return {
            type: 'tilelayer' as const,
            name: layer.name,
            width: grid.cols,
            height: grid.rows,
            x: 0,
            y: 0,
            opacity: 1,
            visible: true,
            data: [...layer.data],
        };
    });

    return {
        type: 'map',
        version: TILED_VERSION,
        orientation: 'orthogonal',
        renderorder: 'right-down',
        infinite: false,
        width: grid.cols,
        height: grid.rows,
        tilewidth: grid.tileSize,
        tileheight: grid.tileSize,
        layers,
        tilesets: [
            {
                name: input.tilesetName,
                firstgid: FIRST_GID,
                tilewidth: atlas.tileSize,
                tileheight: atlas.tileSize,
                margin: 0,
                spacing: 0,
                columns: atlas.cols,
                tilecount: atlas.cols * atlas.rows,
                image: input.atlasImage,
                imagewidth: atlas.width,
                imageheight: atlas.height,
            },
        ],
    };
}