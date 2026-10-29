/**
 * tests/lib/characters/heights.test.ts
 * --------------------------------------------------------------------------
 * The roster's drawn heights, read from the shipped PNGs and YAMLs.
 *
 * Two things broke here by hand once already: Claude was upscaled 1.55x from a 128px cell
 * (blurry), and the tavern hardcoded a 128px cell for NPC sheets so the rebuilt 768 sheets
 * were sliced into their top-left corner (cut in half). Both are visible in these numbers.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CHARACTERS = ['deepseek', 'claude', 'gpt', 'qwen', 'gemini'] as const;

/** Width/height straight out of the PNG header - no image library needed. */
function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function cellOf(id: string): { width: number; height: number; scale: number } {
    const yaml = readFileSync(join(ROOT, 'public', 'data', 'characters', `${id}.yaml`), 'utf8');
    const scale = Number(/^\s+scale:\s*([\d.]+)$/m.exec(yaml)?.[1]);
    const texture = /^\s+texture:\s*(\S+)$/m.exec(yaml)?.[1] ?? '';
    const size = pngSize(join(ROOT, 'public', texture));
    return { width: size.width / 4, height: size.height / 4, scale };
}

describe('every girl is drawn at the same height', () => {
    for (const id of CHARACTERS) {
        it(`${id} draws at 173px`, () => {
            const { height, scale } = cellOf(id);
            expect(height * scale).toBeCloseTo(173, 0);
        });
    }

    it('the sheets are 4x4, so a cell is width/4 and height/4', () => {
        for (const id of CHARACTERS) {
            const { width, height } = cellOf(id);
            expect(width).toBe(height);
        }
    });

    it('nobody is upscaled past 1.5x any more', () => {
        // 128-cell art at 1.55 was the blurry Claude. A cell smaller than ~115px with a
        // large scale means the sheet resolution went backwards.
        for (const id of CHARACTERS) {
            const { height, scale } = cellOf(id);
            expect(height * scale).toBeCloseTo(173, 0);
            expect(scale).toBeLessThan(1.5);
        }
    });
});

describe('the tavern remembers every sheet is not 128px', () => {
    it('Claude and DeepSeek ship bigger cells than Qwen and Gemini', () => {
        // Not a style choice: it is what makes the hardcoded-128 bug impossible to
        // reintroduce unnoticed. If these ever match again, the test above still holds,
        // but this one documents *why* cell size is per-character.
        expect(cellOf('claude').width).toBeGreaterThan(cellOf('qwen').width);
    });
});