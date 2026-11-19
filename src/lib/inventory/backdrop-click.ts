/**
 * src/lib/inventory/backdrop-click.ts
 * --------------------------------------------------------------------------
 * Which backdrop clicks are allowed to close the backpack.
 *
 * The bag is opened from a chip that sits **under** the backdrop, so the tap that opens it also
 * delivers a `click` to the backdrop a moment later - the overlay existed by then, so it closed
 * itself within one frame. The owner: `背包按钮点不开，点了闪一下就没了`.
 *
 * A short window after opening is therefore not a dismissal. It is the opening tap arriving.
 */

/**
 * How long after opening a backdrop click still counts as the opening tap.
 *
 * Longer than a slow tap (a finger that rests before lifting is ~200ms) and shorter than the
 * time it takes a player to decide they want the bag closed again.
 */
export const BACKDROP_CLICK_GRACE_MS = 320;

/**
 * True when a backdrop click should be ignored because the overlay has only just appeared.
 *
 * Kept pure so the rule is testable without mounting the overlay; a clock that goes backwards
 * (a fresh `performance.now()` baseline) is treated as "just opened" rather than as a dismissal.
 */
export function ignoresBackdropClick(openedAt: number, now: number): boolean {
    if (openedAt <= 0) return false;
    return now - openedAt < BACKDROP_CLICK_GRACE_MS;
}