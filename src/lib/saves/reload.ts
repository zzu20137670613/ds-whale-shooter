/**
 * src/lib/saves/reload.ts
 * --------------------------------------------------------------------------
 * The one place that reloads the page when a save is loaded.
 *
 * Loading a slot used to restart the level in place, which kept the previous level's
 * textures and scene instance alive: the owner loaded a 天空之城 save and got Atlantis's
 * artwork under 天空之城's title with no player on screen
 * (`从天空直接去往亚特兰蒂斯出现了这种情况`). A full reload throws all of that away.
 *
 * Kept in its own module so a test can replace it - `window.location.reload` is not
 * something happy-dom will let us observe.
 */

/** Delay before the reload, so the "已读档" line is visible for one frame. */
export const SAVE_RELOAD_DELAY_MS = 120;

export function reloadPageForSave(): void {
    window.setTimeout(() => window.location.reload(), SAVE_RELOAD_DELAY_MS);
}
/**
 * Leave the current level for another one.
 *
 * Every level change - a portal, a trigger, the tavern door, the editor's preview - goes
 * through a full page load. Restarting the scene in place kept Phaser's global
 * TextureManager: the owner walked from 天空之城 into 亚特兰蒂斯 and got Atlantis's water
 * under sky-city's title, with no player on screen
 * (`天空之城进入亚特兰蒂斯还会出现这个问题吗`). A reload rebuilds the Phaser instance, which is
 * the only thing that cannot half-succeed.
 *
 * The target is written to the persisted store first, and the boot reads `currentLevelId`,
 * so the reload lands on exactly that level.
 */
export function transitionToLevel(levelId: string, setLevel: (id: string) => void): void {
    setLevel(levelId);
    window.setTimeout(() => window.location.reload(), SAVE_RELOAD_DELAY_MS);
}
