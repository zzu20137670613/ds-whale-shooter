/**
 * tests/lib/levels/atlantis-corner-exclusion.test.ts
 * --------------------------------------------------------------------------
 * The Atlantean throne room must not spawn anything in its top-right corner.
 *
 * The owner, 2026-11-12: `亚特兰蒂斯最后一关的右上角还会刷怪，把这个角也给禁掉`。 The
 * screenshot showed a guardian hanging off the very top edge, over the cliff/deep-water art
 * that no character can stand on.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';

const ID = 'dsh-atlantis-4-coronation-dais';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${ID}.yaml`), 'utf8'),
    ID,
);

const excluded = level.spawner?.exclude ?? [];

function covers(x: number, y: number): boolean {
    return excluded.some(
        (rect) =>
            x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
    );
}

describe('the Atlantean throne room', () => {
    it('carves its top-right corner out of the spawn area', () => {
        expect(excluded.length).toBeGreaterThan(0);
    });

    it('covers the corner where the monster was hanging off the screen', () => {
        // The plate is 5504x3072; these are the deep-water / coral pixels in that corner.
        for (const [x, y] of [
            [4200, 120],
            [4800, 320],
            [5300, 600],
            [5450, 60],
        ] as [number, number][]) {
            expect(covers(x, y), `(${x},${y})`).toBe(true);
        }
    });

    it('still lets the arena floor and the lower half spawn', () => {
        // Throne dais, plaza, and the bottom corners stay open.
        expect(covers(2750, 1500)).toBe(false);
        expect(covers(3000, 2500)).toBe(false);
        expect(covers(5200, 2700)).toBe(false);
        expect(covers(600, 1800)).toBe(false);
    });

    it('keeps the exclusion to a corner, not the whole plate', () => {
        const area = excluded.reduce((sum, rect) => sum + rect.width * rect.height, 0);
        expect(area).toBeLessThan(5504 * 3072 * 0.15);
    });
});