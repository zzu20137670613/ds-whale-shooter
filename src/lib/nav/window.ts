/**
 * src/lib/nav/window.ts
 * --------------------------------------------------------------------------
 * The world region a camera-local pathfinding grid covers.
 *
 * Pure arithmetic, no Phaser. `PathfindingService` uses it to size its grid to
 * what the camera can see plus a margin, because one A* call on a full 9x9 grid
 * measured 200-400ms and barely moved with path length — that is easystar
 * re-initialising a 1.34M-cell node grid, not searching, so shrinking the grid
 * is the only lever that helps.
 *
 * The origin snaps down to a whole cell. That is what lets a windowed grid keep
 * plain `floor(x / cellSize)` indexing: subtracting a whole number of cells
 * leaves the index identical to the full-map one, so a path found inside the
 * window is the same path the whole world would have produced.
 */

export interface WorldSize {
    width: number;
    height: number;
}

export interface GridWindow {
    /** World x of the window's left edge — always a whole number of cells. */
    originX: number;
    /** World y of the window's top edge — always a whole number of cells. */
    originY: number;
    /** Covered span, i.e. `cols * cellSize` (never narrower than the request). */
    width: number;
    height: number;
    cols: number;
    rows: number;
}

/**
 * The grid window that covers `view` grown by `margin`, clipped to the world.
 * Structurally typed so both `lib/props/activation`'s Rect and Phaser's
 * Rectangle can be passed straight in.
 */
export function windowFor(
    view: { left: number; top: number; right: number; bottom: number },
    cellSize: number,
    margin: number,
    world: WorldSize,
): GridWindow {
    const originX = snapDown(Math.max(0, view.left - margin), cellSize);
    const originY = snapDown(Math.max(0, view.top - margin), cellSize);

    // Reach the far side of the view plus the margin, but never past the world.
    const right = Math.min(world.width, view.right + margin);
    const bottom = Math.min(world.height, view.bottom + margin);

    const cols = Math.max(1, Math.ceil((right - originX) / cellSize));
    const rows = Math.max(1, Math.ceil((bottom - originY) / cellSize));

    return { originX, originY, width: cols * cellSize, height: rows * cellSize, cols, rows };
}

function snapDown(value: number, cellSize: number): number {
    return Math.floor(value / cellSize) * cellSize;
}