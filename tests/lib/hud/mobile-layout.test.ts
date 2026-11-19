// @vitest-environment happy-dom
/**
 * tests/lib/hud/mobile-layout.test.ts
 * --------------------------------------------------------------------------
 * The phone HUD's right-hand column, top to bottom.
 *
 * 主人 2026-11-13：`手机端将4个武器格子的位置与连击数，剩余怪物数的位置对调一下，现在从上到下的
 * 位置是连击数-剩余怪物数-武器格子，改成从上到下的位置是武器格子-剩余怪物数-连击数`。
 *
 * Four components share these numbers, so this file pins the ORDER and the non-overlap rules
 * rather than the raw pixels.
 */

import { describe, expect, it } from 'vitest';

import {
    BACKPACK_BOTTOM_PX,
    BACKPACK_BUTTON_PX,
    BACKPACK_RIGHT_PX,
    COMBO_TOP_PX,
    DODGE_BUTTON_PX,
    MONSTER_COUNTER_TOP_PX,
    MOBILE_BAG_SCALE,
    MOBILE_CARD_WIDTH_PX,
    RIGHT_EDGE_PX,
    SKILL_BUTTON_PX,
    SLOT_PX,
    SLOT_TOP_PX,
    TOP_CHIP_LEFT_PX,
    bagScale,
    skillButtonTop,
    slotRows,
    topChipTop,
    weaponGridBottom,
} from '@/lib/hud/mobile-layout';

describe('the weapon grid', () => {
    it('is one row for two slots and two rows for four', () => {
        expect(slotRows(1)).toBe(1);
        expect(slotRows(2)).toBe(1);
        expect(slotRows(3)).toBe(2);
        expect(slotRows(4)).toBe(2);
    });

    it('reserves at least one row even when empty', () => {
        expect(slotRows(0)).toBe(1);
    });

    it('grows downward by one slot plus one gap per row', () => {
        expect(weaponGridBottom(2)).toBe(SLOT_TOP_PX + SLOT_PX);
        expect(weaponGridBottom(4)).toBe(SLOT_TOP_PX + SLOT_PX * 2 + 6);
    });
});

describe('the right-hand column reads weapons -> 剩余怪物数 -> 连击', () => {
    it('puts the weapon grid at the very top', () => {
        expect(SLOT_TOP_PX).toBeLessThan(MONSTER_COUNTER_TOP_PX);
        expect(SLOT_TOP_PX).toBeLessThan(COMBO_TOP_PX);
    });

    it('drops the monster counter under the grid, never over it', () => {
        expect(MONSTER_COUNTER_TOP_PX).toBeGreaterThanOrEqual(weaponGridBottom(4));
    });

    it('drops the combo counter under the monster line', () => {
        expect(COMBO_TOP_PX).toBeGreaterThan(MONSTER_COUNTER_TOP_PX);
    });

    it('keeps the whole column clear of the skill key on a phone-shaped layer', () => {
        // The mobile HUD layer is 853x480 whatever the device (see use-hud-scale).
        expect(COMBO_TOP_PX).toBeLessThan(skillButtonTop(480));
    });

    it('does not move when a third weapon is picked up', () => {
        // The counters are placed against the grid's DESIGN capacity, not its live height: a
        // column that slides is worse than one with a slightly bigger gap.
        expect(MONSTER_COUNTER_TOP_PX).toBe(weaponGridBottom(4) + 6);
    });
});

describe('the backpack chip', () => {
    it('moved out of the counter gap: it now sits beside the skill key', () => {
        expect(BACKPACK_RIGHT_PX).toBe(RIGHT_EDGE_PX + SKILL_BUTTON_PX + 14);
        // Left of the skill key, so it cannot cover it.
        expect(BACKPACK_RIGHT_PX).toBeGreaterThan(RIGHT_EDGE_PX + SKILL_BUTTON_PX - 1);
    });

    it('does not overlap the skill key or the fire button', () => {
        // Same bottom edge as the skill key, so the two sit in one row.
        expect(BACKPACK_BOTTOM_PX + BACKPACK_BUTTON_PX).toBeGreaterThanOrEqual(
            24 + DODGE_BUTTON_PX,
        );
        expect(BACKPACK_BOTTOM_PX).toBeGreaterThan(0);
    });
});

describe('the top-left cluster', () => {
    it('stacks language above money, to the right of the HP/SP card', () => {
        expect(TOP_CHIP_LEFT_PX).toBeGreaterThan(MOBILE_CARD_WIDTH_PX);
        expect(topChipTop(1)).toBeGreaterThan(topChipTop(0));
    });

    it('keeps the two chips clear of each other', () => {
        expect(topChipTop(1) - topChipTop(0)).toBeGreaterThanOrEqual(24);
    });
});

describe('the bag panel scale', () => {
    it('is the owner\u2019s 4/5 on the desktop and on a roomy phone', () => {
        expect(MOBILE_BAG_SCALE).toBe(0.8);
        expect(bagScale(500, 900, true)).toBe(0.8);
        expect(bagScale(500, 900, false)).toBe(1);
    });

    it('shrinks further rather than running off a short screen', () => {
        const scale = bagScale(460, 360, true);
        expect(scale).toBeLessThan(MOBILE_BAG_SCALE);
        expect(scale * 460).toBeLessThanOrEqual(360);
    });

    it('never collapses to nothing on a silly measurement', () => {
        expect(bagScale(0, 0, true)).toBe(MOBILE_BAG_SCALE);
        expect(bagScale(5000, 300, true)).toBeGreaterThanOrEqual(0.5);
    });
});
