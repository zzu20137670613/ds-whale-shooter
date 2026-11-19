/**
 * tests/lib/weapons/level-label.test.ts
 * --------------------------------------------------------------------------
 * The rung printed after a weapon's name on its card.
 *
 * The owner: `把武器卡片下方的武器名字和弹药/备弹数字体加大1号，在武器名字后方加上等级0/1/2/3/4/max`.
 * The card has to answer "how far is this gun from finished" at a glance, so the label is the
 * bare number while there is headroom and `max` once the ladder is spent - never `4 / 4`, which
 * would take the space the magazine counter needs.
 */

import { describe, expect, it } from 'vitest';

import { weaponLevelLabel } from '@/lib/weapons/level-label';

describe('weaponLevelLabel', () => {
    it('prints the number while there is room to grow', () => {
        expect(weaponLevelLabel(0, 4)).toBe('0');
        expect(weaponLevelLabel(1, 4)).toBe('1');
        expect(weaponLevelLabel(3, 4)).toBe('3');
    });

    it('prints max once the ladder is spent', () => {
        expect(weaponLevelLabel(4, 4)).toBe('max');
    });

    it('prints 0 for a weapon that cannot be upgraded at all', () => {
        // The whale-tail and other ladderless guns live at 0 forever; saying so beats a blank
        // that looks like a missing field.
        expect(weaponLevelLabel(0, 0)).toBe('0');
    });

    it('never prints a rung past the ladder, even if the save says so', () => {
        expect(weaponLevelLabel(9, 4)).toBe('max');
    });

    it('treats junk as level 0', () => {
        expect(weaponLevelLabel(Number.NaN, 4)).toBe('0');
        expect(weaponLevelLabel(-3, 4)).toBe('0');
        expect(weaponLevelLabel(1.6, 4)).toBe('1');
    });
});