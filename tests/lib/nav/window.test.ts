import { describe, expect, it } from 'vitest';

import { windowFor } from '@/lib/nav/window';

const WORLD = { width: 24768, height: 13824 };
const VIEW = { left: 1000, top: 500, right: 3752, bottom: 2036 };
const MARGIN = 512;

describe('windowFor', () => {
    it('covers the view plus the margin, snapped to whole cells', () => {
        const window = windowFor(VIEW, 16, MARGIN, WORLD);
        // left 1000-512=488 snaps down to 480; right 3752+512=4264 is reached by
        // 237 cells (3792px) at 480+3792=4272.
        expect(window.originX).toBe(480);
        // top 500-512 is negative, so it clips to the world edge.
        expect(window.originY).toBe(0);
        expect(window.cols).toBe(237);
        expect(window.rows).toBe(160);
        expect(window.width).toBe(window.cols * 16);
        expect(window.height).toBe(window.rows * 16);
    });

    it('covers every part of the region it was asked for', () => {
        const window = windowFor(VIEW, 16, MARGIN, WORLD);
        // The window cannot cover what lies outside the world, so the near edges
        // clamp at the world border before comparing.
        expect(window.originX).toBeLessThanOrEqual(Math.max(0, VIEW.left - MARGIN));
        expect(window.originY).toBeLessThanOrEqual(Math.max(0, VIEW.top - MARGIN));
        expect(window.originX + window.width).toBeGreaterThanOrEqual(VIEW.right + MARGIN);
        expect(window.originY + window.height).toBeGreaterThanOrEqual(VIEW.bottom + MARGIN);
    });

    it('snaps the origin to a whole cell so grid indices match the full-grid mapping', () => {
        // This is the property that lets a windowed grid reuse plain
        // floor(x / cellSize) indexing: subtract a whole number of cells and the
        // result is identical to the full-map index.
        const window = windowFor(VIEW, 16, MARGIN, WORLD);
        expect(window.originX % 16).toBe(0);
        expect(window.originY % 16).toBe(0);
    });

    it('is a small fraction of a 9x9 world grid', () => {
        const window = windowFor(VIEW, 16, MARGIN, WORLD);
        expect(window.cols * window.rows).toBe(37920);

        const fullGrid = Math.ceil(WORLD.width / 16) * Math.ceil(WORLD.height / 16);
        expect(fullGrid / (window.cols * window.rows)).toBeGreaterThan(30);
    });

    it('stops exactly at the far world edge', () => {
        const window = windowFor(
            { left: 24700, top: 13800, right: 24768, bottom: 13824 },
            16,
            MARGIN,
            WORLD,
        );
        expect(window.originX).toBe(24176);
        expect(window.originX + window.width).toBe(24768);
        expect(window.originY + window.height).toBe(13824);
    });

    it('keeps at least one cell for a tiny view', () => {
        const window = windowFor({ left: 0, top: 0, right: 1, bottom: 1 }, 16, 0, {
            width: 100,
            height: 100,
        });
        expect(window).toEqual({
            originX: 0,
            originY: 0,
            width: 16,
            height: 16,
            cols: 1,
            rows: 1,
        });
    });
});