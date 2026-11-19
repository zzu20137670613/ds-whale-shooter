/**
 * src/lib/bosses/arena.ts
 * --------------------------------------------------------------------------
 * The four-block walk of the final fight.
 *
 * The owner, verbatim: `四块分别是废墟 → 星海 → 街巷 → 教堂。箭头出现条件是什么：第一个箭头打掉
 * 前两个阶段（灭世+神）出现，然后进入星海后，过两秒第三阶段出现在星海中央，打掉第三阶段出现
 * 箭头进入街巷，过两秒第四阶段出现在街巷中央。打掉第四阶段...同理`.
 *
 * So the fight is one boss entity walked around one 11008x6144 map, and the phases are grouped:
 *
 *   block 0  NW 废墟   phases 0 (灭世) + 1 (神)   -> arrow right
 *   block 1  NE 星海   phase  2 (半神)            -> arrow down
 *   block 2  SE 街巷   phase  3 (半神半人)        -> arrow left
 *   block 3  SW 教堂   phase  4 (克劳德)          -> the ending
 *
 * Everything here is arithmetic on the level size, so the rule can be read and tested without a
 * scene. The loop that draws the arrow and moves people lives in `src/game/bosses/arena-loop.ts`.
 */

export type ArenaEdge = 'right' | 'bottom' | 'left' | null;

export interface ArenaBlock {
    /** Position in the walk, 0..3. */
    index: number;
    id: 'ruins' | 'star-sea' | 'alley' | 'church';
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The walk, clockwise from the top-left block. Matches the level's own four paintings. */
const WALK: readonly ArenaBlock['id'][] = ['ruins', 'star-sea', 'alley', 'church'];

/** How far from the block edge the arrow sits, in px. */
export const ARROW_INSET_PX = 220;

/** Radius around the arrow that counts as "walked into it". */
export const ARROW_RADIUS_PX = 120;

/** How long after arriving in a new block the next phase appears. */
export const NEXT_PHASE_DELAY_MS = 2000;

/** The four quadrants of a 2x2 map, in walk order. */
export function arenaBlocks(imageSize: { width: number; height: number }): ArenaBlock[] {
    const halfW = Math.floor(imageSize.width / 2);
    const halfH = Math.floor(imageSize.height / 2);
    const spots = [
        { x: 0, y: 0 },
        { x: halfW, y: 0 },
        { x: halfW, y: halfH },
        { x: 0, y: halfH },
    ];
    return spots.map((spot, index) => ({
        index,
        id: WALK[index],
        x: spot.x,
        y: spot.y,
        width: index % 2 === 0 ? halfW : imageSize.width - halfW,
        height: index < 2 ? halfH : imageSize.height - halfH,
    }));
}

/**
 * Which phases are fought in which block.
 *
 * The first block carries two phases (灭世 then 神) - the only block that does - and every
 * later block carries exactly one.
 */
export function phaseGroups(phaseCount: number): number[][] {
    if (phaseCount <= 0) return [];
    if (phaseCount <= 4) {
        // A boss with four phases or fewer still uses the same walk, one block at a time.
        return Array.from({ length: phaseCount }, (_, i) => [i]);
    }
    const groups: number[][] = [[0, 1]];
    for (let i = 2; i < phaseCount; i++) groups.push([i]);
    return groups;
}

/** The block a phase is fought in, or -1 when the index is out of range. */
export function blockForPhase(phaseIndex: number, phaseCount: number): number {
    const groups = phaseGroups(phaseCount);
    const found = groups.findIndex((group) => group.includes(phaseIndex));
    return found;
}

/** True when clearing this phase finishes its block, i.e. an arrow is owed. */
export function arrowDueAfter(phaseIndex: number, phaseCount: number): boolean {
    const groups = phaseGroups(phaseCount);
    const block = blockForPhase(phaseIndex, phaseCount);
    if (block < 0) return false;
    const group = groups[block];
    // 灭世 (phase 0) only closes half of the first block - 神 still has to fall there.
    if (group[group.length - 1] !== phaseIndex) return false;
    // The last block ends the fight; it does not hand out an arrow.
    return block < groups.length - 1;
}

/** Which edge of the block the arrow sits on: the one facing the next block. */
export function arrowEdge(blockIndex: number): ArenaEdge {
    if (blockIndex < 0 || blockIndex >= 3) return null;
    return blockIndex === 0 ? 'right' : blockIndex === 1 ? 'bottom' : 'left';
}

/** Where the arrow (and its walk-in zone) sits. */
export function arrowPoint(block: ArenaBlock): { x: number; y: number } {
    const edge = arrowEdge(block.index);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    if (edge === 'right') return { x: block.x + block.width - ARROW_INSET_PX, y: cy };
    if (edge === 'left') return { x: block.x + ARROW_INSET_PX, y: cy };
    if (edge === 'bottom') return { x: cx, y: block.y + block.height - ARROW_INSET_PX };
    return { x: cx, y: cy };
}

/**
 * Where the boss appears in a block.
 *
 * The level may author the spots (`arenaSpawn`); the owner marked them by hand because the
 * middle of a painted block is not always where the arena reads. Falls back to the centre.
 */
export function bossSpawnPoint(
    block: ArenaBlock,
    authored?: readonly { x: number; y: number }[] | null,
): { x: number; y: number } {
    const spot = authored?.[block.index];
    return spot ? { x: spot.x, y: spot.y } : blockCentre(block);
}

/** Where the boss stands after the player walks through: the middle of the new block. */
export function blockCentre(block: ArenaBlock): { x: number; y: number } {
    return { x: block.x + block.width / 2, y: block.y + block.height / 2 };
}

/**
 * Where the player lands after walking through an arrow: just inside the new block.
 *
 * The first draft was pure geometry, and the boss map punished it: the wall between the star
 * sea and the alley (`w-30`, x 5376..10912, y 3072..3520) covers the whole seam, so the
 * landing point was INSIDE a wall and the player could not move (`从星海地图直接通往小巷好像不通`).
 *
 * Pass `isFree` - the scene passes its collapsed-grid check - and the landing walks inward
 * from the edge until it finds floor. Geometry alone still answers when no check is given.
 */
export function arrivalPoint(
    block: ArenaBlock,
    isFree?: (x: number, y: number) => boolean,
): { x: number; y: number } {
    const base = rawArrivalPoint(block);
    if (!isFree) return base;
    if (isFree(base.x, base.y)) return base;

    // Probe inward: entered from the left -> +x, from the top -> +y, from the right -> -x.
    const step = 48;
    for (let travelled = step; travelled <= 2400; travelled += step) {
        const point =
            block.index === 1
                ? { x: base.x + travelled, y: base.y }
                : block.index === 2
                  ? { x: base.x, y: base.y + travelled }
                  : { x: base.x - travelled, y: base.y };
        if (isFree(point.x, point.y)) return point;
    }
    return base;
}

/** The plain geometric landing, before any wall is considered. */
export function rawArrivalPoint(block: ArenaBlock): { x: number; y: number } {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    if (block.index === 1) return { x: block.x + ARROW_INSET_PX, y: cy };
    if (block.index === 2) return { x: cx, y: block.y + ARROW_INSET_PX };
    if (block.index === 3) return { x: block.x + block.width - ARROW_INSET_PX, y: cy };
    return { x: cx, y: cy };
}

/**
 * Which `arenaSpawn` entry a phase is fought at.
 *
 * The owner's design, restated after play-testing:
 *   `第二阶段神·Claude直接接续上灭世·Claude，原地复活，之后第三阶段半神半人才开始换地方`.
 *
 * So phases 1 and 2 share the first spot, and from phase 3 on each phase takes the next one:
 *
 *   phase 1 (灭世)      -> spot 0
 *   phase 2 (神)        -> spot 0   (resurrects where she fell, no walk)
 *   phase 3 (半神)      -> spot 1
 *   phase 4 (半神半人)  -> spot 2
 *   phase 5 (克劳德)    -> spot 3
 *
 * Returns null when the level authored fewer spots than the phase needs.
 */
export function arenaSpotIndexForPhase(phaseIndex: number, spotCount: number): number | null {
    const index = phaseIndex <= 1 ? 0 : phaseIndex - 1;
    return index < spotCount ? index : null;
}
