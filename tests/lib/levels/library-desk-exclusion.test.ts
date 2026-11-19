/**
 * tests/lib/levels/library-desk-exclusion.test.ts
 * --------------------------------------------------------------------------
 * The big desk in the library counter must never have a monster standing on it.
 *
 * The owner: `又出现了图书馆柜台关右下角大书桌这里刷怪的情况，把大书桌这里写死右小角这个
 * 区域不刷怪（刷别的地方去）`。
 *
 * The screenshot showed a 星空潜行者 standing on the tabletop. The spawner already
 * supports `exclude` rectangles (the sky-city plate uses them for its rooftops), so
 * this is a data fix; the test pins the rectangle so a later retune cannot quietly
 * delete it, and proves the rectangle still covers the desk the player can see.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';

const ID = 'starry-library-2-counter';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${ID}.yaml`), 'utf8'),
    ID,
);

const excluded = level.spawner?.exclude ?? [];

/** Points a spawn must never land on: the tabletop, the lamp and the chair. */
const ON_OR_ABOVE_THE_DESK: [number, number, string][] = [
    [4700, 2500, '桌面正中（书和茶壶之间）'],
    [5150, 2150, '桌面右上（台灯旁）'],
    [5350, 2900, '椅子一带'],
    [4100, 2750, '桌面左下角（夹板旁）'],
];

function covers(x: number, y: number): boolean {
    return excluded.some(
        (rect) =>
            x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
    );
}

describe('the library counter spawner', () => {
    it('carves the desk out of its spawn area', () => {
        expect(excluded.length).toBeGreaterThan(0);
    });

    it('covers every corner of the desk the player can see', () => {
        for (const [x, y, label] of ON_OR_ABOVE_THE_DESK) {
            expect(covers(x, y), `${label} (${x},${y})`).toBe(true);
        }
    });

    it('leaves the open floor spawnable', () => {
        // Straight in front of the desk, middle of the room: still a spawn zone.
        expect(covers(2000, 1500)).toBe(false);
        expect(covers(1000, 2600)).toBe(false);
        // The desk rectangle must not swallow the whole plate.
        const area = excluded.reduce((sum, rect) => sum + rect.width * rect.height, 0);
        expect(area).toBeLessThan(5504 * 3072 * 0.25);
    });
});