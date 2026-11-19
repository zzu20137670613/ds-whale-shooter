/**
 * tests/lib/levels/floor-text.test.ts
 * --------------------------------------------------------------------------
 * Words on the floor.
 *
 * The hidden map is a placeholder until its art exists, and it has to explain itself where
 * the player is standing - how the map gets made, how to swap the art in, and how to ask the
 * author for a bespoke one.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import {
    FLOOR_TEXT_DEFAULT_COLOUR,
    FLOOR_TEXT_DEFAULT_SIZE,
} from '@/game/levels/floor-text';

const ROOT = process.cwd();
const hidden = parseLevelYaml(
    readFileSync(join(ROOT, 'public', 'data', 'levels', 'hidden-whale.yaml'), 'utf8'),
    'hidden-whale',
);

describe('the level field', () => {
    it('is optional, so old levels still parse', () => {
        const plain = parseLevelYaml(
            readFileSync(join(ROOT, 'public', 'data', 'levels', 'dev-cabin.yaml'), 'utf8'),
            'dev-cabin',
        );
        expect(plain.floorText).toBeUndefined();
    });

    it('carries text, position and optional styling', () => {
        const entries = hidden.floorText ?? [];
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
            expect(typeof entry.text).toBe('string');
            expect(entry.text.length).toBeGreaterThan(0);
            expect(Number.isFinite(entry.x)).toBe(true);
            expect(Number.isFinite(entry.y)).toBe(true);
        }
    });

    it('rounds coordinates, so a level cannot author a half-pixel', () => {
        const parsed = parseLevelYaml(
            [
                'title: T',
                'titleZh: "题目"',
                'background: assets/image/scenes/tavern.png',
                'imageSize: 100x100',
                'airWalls: []',
                'characterSpawn: { x: 50, y: 50, facing: right }',
                'floorText:',
                '    - { x: 10.6, y: 20.4, text: hello }',
            ].join('\n'),
            'probe',
        );
        expect(parsed.floorText?.[0]).toMatchObject({ x: 11, y: 20, text: 'hello' });
    });
});

describe('the placeholder map explains itself', () => {
    const text = (hidden.floorText ?? []).map((entry) => entry.text).join('\n');

    it('says what size to paint', () => {
        expect(text).toContain('2752x1536');
    });

    it('says where the art goes and which line to change', () => {
        expect(text).toContain('public/assets/image/scenes/');
        expect(text).toContain('background');
    });

    it('says how to replace the words', () => {
        expect(text).toContain('floorText');
    });

    it('points at the Gitee issue page for a bespoke map', () => {
        expect(text).toContain('gitee.com/zzu20137670613/ds-whale-shooter-PC/issues');
    });
});

describe('the defaults', () => {
    it('are readable without any styling in the YAML', () => {
        expect(FLOOR_TEXT_DEFAULT_SIZE).toBeGreaterThanOrEqual(24);
        expect(FLOOR_TEXT_DEFAULT_COLOUR).toMatch(/^#[0-9a-f]{6}$/i);
    });
});

describe('the placeholder art', () => {
    it("is a blank sheet, not somebody else's map", () => {
        // `占位版用全白地图，别拿已有地图占位`
        expect(hidden.background).toBe('assets/image/scenes/hidden-whale/hidden-whale-blank.png');
        expect(hidden.background).not.toContain('tavern');
    });

    it('is the size the level declares', () => {
        expect(hidden.imageSize).toEqual({ width: 2752, height: 1536 });
    });

    it('is big enough for the words to be read', () => {
        // Two more steps (+4px) on top of the first bump.
        for (const entry of hidden.floorText ?? []) {
            expect(entry.fontSize ?? 30).toBeGreaterThanOrEqual(30);
        }
        expect((hidden.floorText ?? [])[0]?.fontSize).toBe(50);
    });
});

describe('the vertical placement', () => {
    it('sits in the upper half, so the exit stays visible', () => {
        // `字体整体往上移大概三行的高度`
        const ys = (hidden.floorText ?? []).map((entry) => entry.y);
        for (const y of ys) {
            expect(y).toBeLessThan(1200);
        }
        // Nothing overlaps the return portal at y 1300.
        expect(Math.max(...ys)).toBeLessThan(1300);
    });

    it('keeps the block together', () => {
        const ys = (hidden.floorText ?? []).map((entry) => entry.y);
        const sorted = [...ys].sort((a, b) => a - b);
        expect(sorted[0]).toBe(350);
        expect(sorted[sorted.length - 1]! - sorted[0]!).toBeLessThan(800);
    });
});
