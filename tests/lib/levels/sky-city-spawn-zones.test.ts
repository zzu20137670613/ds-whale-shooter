/**
 * tests/lib/levels/sky-city-spawn-zones.test.ts
 * --------------------------------------------------------------------------
 * The no-spawn rectangles still cover the places nobody can stand on.
 *
 * The owner kept losing monsters into the roof of the pavilion and the high ground around
 * the throne (`天穹之城刷怪在右上角的屋顶上方`). The fix was to forbid spawning inside those
 * rectangles. The rectangles were authored on the 11008x6144 plate; the split moved each one
 * into the block that owns it, so this file now reads all four levels and checks the union.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';

const LEVELS = join(process.cwd(), 'public', 'data', 'levels');
const load = (id: string) =>
    parseLevelYaml(readFileSync(join(LEVELS, `${id}.yaml`), 'utf8'), id);

/** Block origin -> level id. */
const BLOCKS = [
    { id: 'gpt-sky-city-1-entrance', x: 0, y: 3072 },
    { id: 'gpt-sky-city-2-moon-bridge', x: 0, y: 0 },
    { id: 'gpt-sky-city-3-great-tome', x: 5504, y: 0 },
    { id: 'gpt-sky-city-4-throne-hall', x: 5504, y: 3072 },
] as const;

/** Every exclude rectangle, back in world pixels. */
const world = BLOCKS.flatMap((block) =>
    (load(block.id).spawner?.exclude ?? []).map((rect) => ({
        id: block.id,
        x: rect.x + block.x,
        y: rect.y + block.y,
        width: rect.width,
        height: rect.height,
    })),
);

const covers = (
    rect: { x: number; y: number; width: number; height: number },
    x: number,
    y: number,
): boolean => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

describe('sky city no-spawn rectangles', () => {
    it('are declared at all', () => {
        expect(world.length).toBeGreaterThanOrEqual(4);
    });

    it('cover the pavilion roof', () => {
        // The pavilion is the RT block; its roof band is the top 1440px of the painting.
        expect(world.some((rect) => covers(rect, 8000, 500))).toBe(true);
    });

    it('cover the throne’s high ground', () => {
        expect(world.some((rect) => covers(rect, 8000, 4500))).toBe(true);
    });

    it('stay inside the painted world', () => {
        // The throne's block is largely high ground, so two of these rectangles legitimately
        // overlap there - what must hold is that none of them leaves the map.
        for (const rect of world) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.y).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(11008);
            expect(rect.y + rect.height).toBeLessThanOrEqual(6144);
        }
    });

});

describe('the far ring stays off the border', () => {
    it('keeps the edge inset at 480', () => {
        // 200 put far points on the painted rim, which is railing and roof, not floor.
        for (const block of BLOCKS) {
            expect(load(block.id).spawner?.far.edgeInset, block.id).toBe(480);
        }
    });
});
