/**
 * src/lib/characters/anim-state.ts
 * --------------------------------------------------------------------------
 * Whether an animation actually has to be (re)started this frame.
 *
 * Comparing the current animation's key is not enough. Phaser's `anims.stop()` leaves
 * `currentAnim` pointing at the animation that just stopped, so after a character froze
 * on a still frame the key still read "walk" - and starting to move skipped the `play`
 * call, leaving her sliding along in the frozen pose. That is exactly the owner's
 * "有时候纯立绘漂移，没有走动动作".
 *
 * The key plus `isPlaying` is the honest question.
 */

/**
 * @param currentKey the key of `sprite.anims.currentAnim`, or null when there is none
 * @param wantedKey  the animation this state wants
 * @param isPlaying  `sprite.anims.isPlaying`
 */
export function needsAnimPlay(
    currentKey: string | null,
    wantedKey: string,
    isPlaying: boolean,
): boolean {
    return currentKey !== wantedKey || !isPlaying;
}