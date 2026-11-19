/**
 * src/lib/ui/fullscreen.ts
 * --------------------------------------------------------------------------
 * The two decisions a fullscreen button makes, kept out of React.
 *
 * The owner: `在游戏里【键盘操作】按钮与git图标之间加一个按钮，【全屏】，点击后变为【窗口】，
 * 控制游戏是否全屏`.
 *
 * Pure because the browser's Fullscreen API cannot be driven from a test, but "what does
 * this click do" and "what should the label say" can be.
 */

/** Which way the next click flips the window. */
export type FullscreenAction = 'enter' | 'exit';

export function nextFullscreenAction(isFullscreen: boolean): FullscreenAction {
    return isFullscreen ? 'exit' : 'enter';
}

/**
 * Whether the page is fullscreen right now.
 *
 * Electron and Chromium both set `document.fullscreenElement`; the vendor-prefixed
 * variants are only reached for when that is undefined (an old Safari on a phone).
 */
export function isFullscreenNow(doc: {
    fullscreenElement?: unknown;
    webkitFullscreenElement?: unknown;
}): boolean {
    if (doc.fullscreenElement !== undefined) return Boolean(doc.fullscreenElement);
    return Boolean(doc.webkitFullscreenElement);
}