// @vitest-environment happy-dom
/**
 * tests/components/hud/shop-level-colour.test.tsx
 * --------------------------------------------------------------------------
 * The level line in the shop is readable.
 *
 * The owner: `将商店里等级的灰色字体改成亮绿色字体，灰色看不清`. `text-stone-500` at 10px sat on a
 * dark row and read as a smudge; `text-lime-400` is the "bright green" he asked for.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    join(process.cwd(), 'src', 'components', 'hud', 'shop-panel.tsx'),
    'utf8',
);

describe('the shop level line', () => {
    it('is bright green', () => {
        expect(SOURCE).toContain('text-[10px] text-lime-400');
    });

    it('is no longer grey', () => {
        // Both rows - the stat ladders and the weapon upgrades.
        expect(SOURCE).not.toContain('text-[10px] text-stone-500');
    });

    it('covers both places the level is printed', () => {
        const count = SOURCE.split('text-[10px] text-lime-400').length - 1;
        expect(count).toBe(2);
    });

    it('leaves the item names alone', () => {
        // The name stays stone-200; only the level line changed.
        expect(SOURCE).toContain('text-[12px] text-stone-200');
    });
});