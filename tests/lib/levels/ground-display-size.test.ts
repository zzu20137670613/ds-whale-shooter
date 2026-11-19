/**
 * tests/lib/levels/ground-display-size.test.ts
 * --------------------------------------------------------------------------
 * A downscaled background must still cover the room it belongs to.
 *
 * `海滩假日` drew a black room on the phone: the painting is 5504x3072, the device reports
 * `gl.getParameter(gl.MAX_TEXTURE_SIZE) === 4096`, and Phaser silently drops a texture it cannot
 * upload. The mobile build now caps those files at 4096 - which only works if the scene draws the
 * picture at the space it was authored for instead of at whatever the file happens to be.
 *
 * 星空图书馆 then showed the same mistake one level up: it is four 5504x3072 paintings at
 * 11008x6144, and drawing each downscaled block 1:1 left a 1488 px black gutter down every seam.
 */

import { describe, expect, it } from 'vitest';

import { groundDisplaySize } from '@/lib/levels/logic';

const level = (width: number, height: number, blocks?: unknown[]) => ({
    imageSize: { width, height },
    backgroundBlocks: blocks as never,
});

const grid = (cellWidth: number, cellHeight: number) => [
    { texture: 'a.png', x: 0, y: 0 },
    { texture: 'b.png', x: cellWidth, y: 0 },
    { texture: 'c.png', x: 0, y: cellHeight },
    { texture: 'd.png', x: cellWidth, y: cellHeight },
];

describe('a single painting', () => {
    it('covers a downscaled painting completely', () => {
        // 5504x3072 painting stored as 4096x2286 on the phone.
        expect(groundDisplaySize(level(5504, 3072))).toEqual({ width: 5504, height: 3072 });
    });

    it('leaves a full-size painting alone', () => {
        expect(groundDisplaySize(level(2752, 1536))).toEqual({ width: 2752, height: 1536 });
    });
});

describe('a level built from blocks', () => {
    it('sizes each block to its cell, not to the world', () => {
        // 星空图书馆: 11008x6144 from four 5504x3072 paintings.
        const size = groundDisplaySize(level(11008, 6144, grid(5504, 3072)));
        expect(size).toEqual({ width: 5504, height: 3072 });
    });

    it('reads the cell from the layout, so a different grid still works', () => {
        const size = groundDisplaySize(level(8000, 4000, grid(2000, 1000)));
        expect(size).toEqual({ width: 2000, height: 1000 });
    });

    it('does not invent a gutter: cell times columns rebuilds the world', () => {
        const size = groundDisplaySize(level(11008, 6144, grid(5504, 3072)));
        expect(size.width * 2).toBe(11008);
        expect(size.height * 2).toBe(6144);
    });

    it('falls back to the world size when every block sits on one row', () => {
        const oneRow = [
            { texture: 'a.png', x: 0, y: 0 },
            { texture: 'b.png', x: 5504, y: 0 },
        ];
        const size = groundDisplaySize(level(11008, 3072, oneRow));
        expect(size.width).toBe(5504);
        // No second row to measure, so the vertical answer is the world height.
        expect(size.height).toBe(3072);
    });
});