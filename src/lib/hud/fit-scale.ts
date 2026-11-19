/**
 * src/lib/hud/fit-scale.ts
 * --------------------------------------------------------------------------
 * 把一块固定尺寸的面板等比缩到视野里要用的比例。
 *
 * 主人 2026-11-16：`手机上最后的赞赏页面太大了，需要等比缩小`。
 * 赞赏面板是按 67.5rem（1080px）画的：手机横向的视口宽度还能被 `max-w` 夹住，
 * **高度**夹不住 —— 两张竖屏图加上说明和两个按钮，底下的东西直接被切掉。
 *
 * 为什么整块缩放而不是逐个改字号：这块面板的排版是「左边两条竖栏 + 中间两张竖图 + 右边一个
 * 两行高的长按钮」对齐出来的，逐个缩字号会把对齐关系改歪；整块按一个比例缩，版式原样。
 *
 * 桌面上算出来就是 1 —— 等于没动。
 */

/** 面板四周留白，免得贴到屏幕边上。 */
const MARGIN = 24;

/**
 * @param panelW 面板自身宽度（px）
 * @param panelH 面板自身高度（px）
 * @param boxW   可用区域宽度（px）
 * @param boxH   可用区域高度（px）
 * @returns 0 < scale ≤ 1；参数不可用（面板还没渲染出来）时返回 1，不缩放。
 */
export function fitScale(panelW: number, panelH: number, boxW: number, boxH: number): number {
    if (!(panelW > 0) || !(panelH > 0) || !(boxW > 0) || !(boxH > 0)) return 1;
    const availW = boxW - MARGIN;
    const availH = boxH - MARGIN;
    if (availW <= 0 || availH <= 0) return 1;
    return Math.min(1, availW / panelW, availH / panelH);
}