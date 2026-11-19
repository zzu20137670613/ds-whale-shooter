/**
 * tests/lib/bosses/arena.test.ts
 * --------------------------------------------------------------------------
 * The owner's walk, written down: 废墟 → 星海 → 街巷 → 教堂.
 *
 * `第一个箭头打掉前两个阶段（灭世+神）出现` - so block 0 holds two phases and every later block
 * holds one. `过两秒第三阶段出现在星海中央` - the delay and the centre are constants here, and the
 * loop that uses them is tested separately.
 */

import { describe, expect, it } from 'vitest';

import {
    ARROW_INSET_PX,
    ARROW_RADIUS_PX,
    NEXT_PHASE_DELAY_MS,
    arenaBlocks,
    arrivalPoint,
    arrowDueAfter,
    arrowEdge,
    arrowPoint,
    blockCentre,
    blockForPhase,
    phaseGroups,
} from '@/lib/bosses/arena';

const SIZE = { width: 11008, height: 6144 };
const BLOCKS = arenaBlocks(SIZE);
const PHASES = 5;

describe('the four blocks', () => {
    it('are the quadrants of the map, in walk order', () => {
        expect(BLOCKS.map((b) => b.id)).toEqual(['ruins', 'star-sea', 'alley', 'church']);
        expect(BLOCKS.map((b) => [b.x, b.y])).toEqual([
            [0, 0],
            [5504, 0],
            [5504, 3072],
            [0, 3072],
        ]);
    });

    it('tile the map with no gaps', () => {
        for (const block of BLOCKS) {
            expect(block.x).toBeGreaterThanOrEqual(0);
            expect(block.y).toBeGreaterThanOrEqual(0);
            expect(block.x + block.width).toBeLessThanOrEqual(SIZE.width);
            expect(block.y + block.height).toBeLessThanOrEqual(SIZE.height);
        }
        const area = BLOCKS.reduce((sum, b) => sum + b.width * b.height, 0);
        expect(area).toBe(SIZE.width * SIZE.height);
    });
});

describe('phases per block', () => {
    it('put 灭世 and 神 together in the ruins', () => {
        expect(phaseGroups(5)).toEqual([[0, 1], [2], [3], [4]]);
    });

    it('map each phase to its block', () => {
        expect([0, 1, 2, 3, 4].map((p) => blockForPhase(p, PHASES))).toEqual([0, 0, 1, 2, 3]);
    });

    it('owe an arrow after 神, 半神 and 半神半人 - but not after 克劳德', () => {
        expect([0, 1, 2, 3, 4].map((p) => arrowDueAfter(p, PHASES))).toEqual([
            false, // 灭世 is only half of the first block
            true, // 神 finishes the ruins
            true, // 半神 finishes the star sea
            true, // 半神半人 finishes the alley
            false, // 克劳德 IS the ending
        ]);
    });

    it('still walks a boss with four phases or fewer', () => {
        expect(phaseGroups(4)).toEqual([[0], [1], [2], [3]]);
        expect(phaseGroups(0)).toEqual([]);
    });

    it('is robust about nonsense indices', () => {
        expect(blockForPhase(-1, PHASES)).toBe(-1);
        expect(blockForPhase(99, PHASES)).toBe(-1);
        expect(arrowDueAfter(99, PHASES)).toBe(false);
    });
});

describe('the arrow', () => {
    it('points right, down, left as the walk turns clockwise, and nowhere on the last block', () => {
        expect([0, 1, 2, 3].map(arrowEdge)).toEqual(['right', 'bottom', 'left', null]);
    });

    it('sits near the edge of its block, not in the middle', () => {
        const p = arrowPoint(BLOCKS[0]);
        expect(p.x).toBe(SIZE.width / 2 - ARROW_INSET_PX);
        expect(p.y).toBe(BLOCKS[0].y + BLOCKS[0].height / 2);
    });

    it('sits inside the block it belongs to', () => {
        for (const block of BLOCKS) {
            const p = arrowPoint(block);
            expect(p.x).toBeGreaterThanOrEqual(block.x);
            expect(p.x).toBeLessThanOrEqual(block.x + block.width);
            expect(p.y).toBeGreaterThanOrEqual(block.y);
            expect(p.y).toBeLessThanOrEqual(block.y + block.height);
        }
    });

    it('has a walk-in radius a player can actually hit while running', () => {
        expect(ARROW_RADIUS_PX).toBeGreaterThanOrEqual(80);
        expect(ARROW_RADIUS_PX).toBeLessThan(ARROW_INSET_PX * 2);
    });
});

describe('arriving in the next block', () => {
    it('drops the player inside it, on the edge they came from', () => {
        for (const block of BLOCKS.slice(1)) {
            const p = arrivalPoint(block);
            expect(p.x).toBeGreaterThanOrEqual(block.x);
            expect(p.x).toBeLessThanOrEqual(block.x + block.width);
            expect(p.y).toBeGreaterThanOrEqual(block.y);
            expect(p.y).toBeLessThanOrEqual(block.y + block.height);
        }
    });

    it('puts the boss in the middle of the block two seconds later', () => {
        expect(blockCentre(BLOCKS[1])).toEqual({ x: 5504 + 2752, y: 1536 });
        expect(NEXT_PHASE_DELAY_MS).toBe(2000);
    });

    it('never lands the player on top of the boss', () => {
        for (const block of BLOCKS.slice(1)) {
            const a = arrivalPoint(block);
            const b = blockCentre(block);
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(400);
        }
    });
});