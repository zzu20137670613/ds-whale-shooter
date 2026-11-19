/**
 * src/lib/hud/mobile-layout.ts
 * --------------------------------------------------------------------------
 * The phone HUD's geometry, in one place.
 *
 * Several components position themselves against the same right-hand column: the weapon grid,
 * the 剩余怪物数 line, the combo counter and the thumb cluster. Each used to carry its own copy
 * of the numbers, which is how a chip ends up floating next to a button that later moved.
 *
 * 主人 2026-11-13 定的右上角顺序（从上到下）：
 *   `改成从上到下位置是武器格子-剩余怪物数-连击数`
 * so the weapon grid moved to the TOP of the column and the two counters follow it. The backpack
 * chip could no longer live in the gap underneath (那一段现在被两行计数占满) and moved one key to
 * the left, beside 技能.
 */

/** A weapon slot's box, in HUD-layer pixels (the layer is scaled, not resized). */
export const SLOT_PX = 56;
export const SLOT_GAP_PX = 6;
/** Distance from the layer's right edge for the whole right-hand column. */
export const RIGHT_EDGE_PX = 16;
export const SLOT_COLUMNS = 2;

/** The board the HUD is designed for: 2 x 2 weapon slots. */
export const WEAPON_CAPACITY = 4;

/** Where the weapon grid starts: the very top of the right-hand column. */
export const SLOT_TOP_PX = 88;

/** How many rows a grid of `count` slots occupies. Never zero: an empty row still reserves space. */
export function slotRows(count: number, columns: number = SLOT_COLUMNS): number {
    return Math.max(1, Math.ceil(Math.max(1, count) / Math.max(1, columns)));
}

/** Bottom edge of the weapon grid, measured from the top of the layer. */
export function weaponGridBottom(count: number): number {
    const rows = slotRows(count);
    return SLOT_TOP_PX + rows * SLOT_PX + (rows - 1) * SLOT_GAP_PX;
}

/** Gap between the stacked widgets of the right-hand column. */
export const COLUMN_GAP_PX = 6;

/**
 * 剩余怪物数 — directly under the weapon grid.
 *
 * Measured against the grid's DESIGN capacity, not the live slot count: the two counters must not
 * slide down the screen the first time a third weapon is picked up.
 */
export const MONSTER_COUNTER_TOP_PX = weaponGridBottom(WEAPON_CAPACITY) + COLUMN_GAP_PX;
/** One 13 px line plus its `py-0.5`, rounded up. */
export const MONSTER_COUNTER_H_PX = 20;

/** 连击数 — the last line of the column. */
export const COMBO_TOP_PX = MONSTER_COUNTER_TOP_PX + MONSTER_COUNTER_H_PX + COLUMN_GAP_PX;

/** The thumb cluster. */
export const CLUSTER_BOTTOM_PX = 24;
export const CLUSTER_GAP_PX = 14;
export const FIRE_BUTTON_PX = 96;
export const DODGE_BUTTON_PX = 80;
export const SKILL_BUTTON_PX = 80;

/** The backpack chip. */
export const BACKPACK_BUTTON_PX = 46;

/**
 * The backpack chip: one key to the LEFT of 技能, on the same bottom edge.
 *
 * It used to sit between the last weapon slot and the skill key. With the counters moved into
 * that gap there is no room left, and the free spot a thumb can reach is beside 技能.
 */
export const BACKPACK_RIGHT_PX = RIGHT_EDGE_PX + SKILL_BUTTON_PX + CLUSTER_GAP_PX;
export const BACKPACK_BOTTOM_PX = CLUSTER_BOTTOM_PX + DODGE_BUTTON_PX + CLUSTER_GAP_PX + 8;

/** Top edge of the skill button, measured from the top of the layer. */
export function skillButtonTop(layerHeight: number): number {
    const fromBottom = CLUSTER_BOTTOM_PX + DODGE_BUTTON_PX + CLUSTER_GAP_PX + SKILL_BUTTON_PX;
    return layerHeight - fromBottom;
}

// ─── 左上角：血蓝卡片 + 语言/金钱 ──────────────────────────────────────────

/** The HP/SP card's width on a phone. */
export const MOBILE_CARD_WIDTH_PX = 220;
/** The card's left inset (`left-4`). */
export const MOBILE_CARD_LEFT_PX = 16;

/**
 * 语言切换与金钱挪到左上角，血蓝卡片的右边（主人 2026-11-13）。
 *
 * They stack vertically rather than sitting side by side: two chips beside the card would run
 * under the level title, which is centred at the top of the same row.
 */
export const TOP_CHIP_LEFT_PX = MOBILE_CARD_LEFT_PX + MOBILE_CARD_WIDTH_PX + 8;
export const TOP_CHIP_TOP_PX = 16;
/** A chip is one 10 px line + `py-1` + a 2 px border. */
export const TOP_CHIP_H_PX = 26;
export const TOP_CHIP_GAP_PX = 6;

/** 0 = 语言 (top chip), 1 = 金钱 (the one under it). */
export function topChipTop(index: number): number {
    return TOP_CHIP_TOP_PX + index * (TOP_CHIP_H_PX + TOP_CHIP_GAP_PX);
}

// ─── 背包面板 ──────────────────────────────────────────────────────────────

/** 手机端背包整体等比缩小到 4/5（主人：`高度等比缩小1/5（宽度什么的一起等比缩小）`）。 */
export const MOBILE_BAG_SCALE = 0.8;

/**
 * The scale the bag panel is drawn at.
 *
 * 4/5 is the target, but a scaled panel that still overflows is the same bug with smaller text,
 * so the fit is taken into account too: on a short screen the panel shrinks further rather than
 * running off the bottom edge.
 */
export function bagScale(naturalH: number, availableH: number, mobile: boolean): number {
    if (!mobile) return 1;
    if (!(naturalH > 0) || !(availableH > 0)) return MOBILE_BAG_SCALE;
    const fit = (availableH - 12) / naturalH;
    return Math.max(0.5, Math.min(MOBILE_BAG_SCALE, fit));
}
