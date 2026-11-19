/**
 * src/lib/hud/notice-duration.ts
 * --------------------------------------------------------------------------
 * 一条提示在屏幕上待多久。
 *
 * 原来是固定的 2.8 秒 —— 那够读完「血上限 +100」，但 2026-11-18 之后台词变长了
 * （安利台词最长 54 字，比如带 gitee 仓库名那几句），固定值会让长句还没读完就消失。
 *
 * 所以按字数给：短提示保持原样，长句顺延，且封顶 —— 不能因为一句话把屏幕占太久。
 */

/** 基础停留时间（和原来的固定值一致）。 */
export const NOTICE_BASE_MS = 2_800;

/** 每多一个字加多少毫秒。 */
export const NOTICE_MS_PER_CHAR = 45;

/** 不额外加时间的前缀字数。 */
export const NOTICE_FREE_CHARS = 10;

/** 上限：再长也不超过这个数。 */
export const NOTICE_MAX_MS = 6_000;

/** 这条提示该显示多久。 */
export function noticeMsFor(text: string | null | undefined): number {
    if (!text) return NOTICE_BASE_MS;
    const chars = [...text].length;
    const extra = Math.max(0, chars - NOTICE_FREE_CHARS) * NOTICE_MS_PER_CHAR;
    return Math.min(NOTICE_MAX_MS, NOTICE_BASE_MS + extra);
}