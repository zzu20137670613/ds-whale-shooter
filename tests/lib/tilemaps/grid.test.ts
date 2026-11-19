import { describe, expect, it } from 'vitest';

import { atlasLayoutFor, tileCountOf, tileGridFor } from '@/lib/tilemaps/grid';

describe('tileGridFor', () => {
    it('covers the shipped beach painting exactly', () => {
        // 2752x1536 is the current level size and this is the only tile size
        // under 100 that divides both axes (2752 = 2^6 * 43, 1536 = 2^9 * 3).
        expect(tileGridFor(2752, 1536, 64)).toEqual({ cols: 43, rows: 24, tileSize: 64 });
    });

    it('refuses an image its tile size cannot tile', () => {
        // 128 does not divide 2752 — silently flooring here would shift every
        // tile on the bottom half of the image.
        expect(() => tileGridFor(2752, 1536, 128)).toThrow(/not a whole number of 128px tiles/);
    });

    it('refuses a tile size that is not a positive integer', () => {
        expect(() => tileGridFor(2752, 1536, 0)).toThrow(/positive integer/);
        expect(() => tileGridFor(2752, 1536, -64)).toThrow(/positive integer/);
        expect(() => tileGridFor(2752, 1536, 64.5)).toThrow(/positive integer/);
    });

    it('counts the tiles a slice produces', () => {
        expect(tileCountOf(tileGridFor(2752, 1536, 64))).toBe(43 * 24);
    });
});

describe('atlasLayoutFor', () => {
    it('lays the whole beach slice out in 64 columns', () => {
        // 1032 tiles -> 64 columns of 64px = 4096 wide, 17 rows = 1088 tall.
        expect(atlasLayoutFor(1032, 64, 64)).toEqual({
            cols: 64,
            rows: 17,
            width: 4096,
            height: 1088,
            tileSize: 64,
        });
    });

    it('does not pad the last row out to a power of two', () => {
        // 1088 is not a power of two and that is fine: tiles are sampled with
        // clamped filtering, so half the VRAM of a 4096x2048 atlas is saved.
        const layout = atlasLayoutFor(1032, 64, 64);
        expect(layout.height).toBe(1088);
        expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(1032);
    });

    it('uses only the columns it needs for a small slice', () => {
        expect(atlasLayoutFor(10, 64, 64)).toEqual({
            cols: 10,
            rows: 1,
            width: 640,
            height: 64,
            tileSize: 64,
        });
    });

    it('refuses nonsense inputs', () => {
        expect(() => atlasLayoutFor(0, 64, 64)).toThrow(/tileCount/);
        expect(() => atlasLayoutFor(10, 64, 0)).toThrow(/maxColumns/);
        expect(() => atlasLayoutFor(10, 0, 64)).toThrow(/tileSize/);
    });
});