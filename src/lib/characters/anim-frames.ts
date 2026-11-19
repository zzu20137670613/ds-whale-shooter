/**
 * src/lib/characters/anim-frames.ts
 * --------------------------------------------------------------------------
 * Which sprite cells one track plays, in which order.
 *
 * `frames: [start, end]` is a closed range, and for a normal cycle that is the
 * whole story: the cells sit next to each other in reading order.
 *
 * A cycle that reads backwards cannot be expressed as a range. DeepSeek's walk
 * was reported as `向前走，但动作是倒退的` - the same four poses, played out of
 * phase. `order` names the cells explicitly so the sequence can be turned
 * around without touching the art.
 */

/**
 * Resolve a track's cell list.
 *
 * @param frames closed range `[first, last]`, both included
 * @param order  optional explicit cell sequence; wins when non-empty. Values
 *               are expected to sit inside `frames` - the schema enforces it.
 */
export function animFrameNumbers(
    frames: readonly [number, number],
    order?: readonly number[],
): number[] {
    if (order && order.length > 0) return [...order];
    const cells: number[] = [];
    for (let i = frames[0]; i <= frames[1]; i++) cells.push(i);
    return cells;
}