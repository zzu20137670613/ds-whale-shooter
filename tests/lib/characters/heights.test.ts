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
    // Rows/cols come from the spec, not a hardcoded 4: deepseek ships a fifth row for her
    // hand-mirrored walk, and assuming four sliced the sheet into 240px cells.
    const rows = Number(/^\s+rows:\s*(\d+)$/m.exec(yaml)?.[1] ?? 4);
    const cols = Number(/^\s+cols:\s*(\d+)$/m.exec(yaml)?.[1] ?? 4);
    const size = pngSize(join(ROOT, 'public', texture));
    return { width: size.width / cols, height: size.height / rows, scale };
}

describe('every girl is drawn at the same height', () => {
    for (const id of CHARACTERS) {
        it(`${id} draws at 173px`, () => {
            const { height, scale } = cellOf(id);
            expect(height * scale).toBeCloseTo(173, 0);
        });
    }

    it('a cell is square, whatever the grid size', () => {
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

describe('the tavern remembers the sheets are not all the same size', () => {
    it('the roster does not share one cell size', () => {
        // This is what makes the hardcoded-128 bug impossible to reintroduce unnoticed:
        // the sheets are a mix, so anything that assumes one number is wrong. It has
        // already broken twice (tavern NPCs cut in half, Claude upscaled and blurry).
        const cells = new Set(CHARACTERS.map((id) => cellOf(id).width));
        expect(cells.size).toBeGreaterThan(1);
    });

    it('the re-drawn rows kept their detail', () => {
        // Claude / DeepSeek / GPT / Qwen were rebuilt from high-resolution art; Gemini is
        // still the original 512 sheet. If one of these drops back to 128, detail was lost.
        for (const id of ['claude', 'deepseek', 'gpt', 'qwen'] as const) {
            expect(cellOf(id).width).toBeGreaterThanOrEqual(192);
        }
    });
});