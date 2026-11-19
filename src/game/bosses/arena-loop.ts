/**
 * src/game/bosses/arena-loop.ts
 * --------------------------------------------------------------------------
 * The four-block walk, driven by the events the fight already emits.
 *
 * The owner's rule, once more: `第一个箭头打掉前两个阶段（灭世+神）出现` then `进入星海后，过两秒
 * 第三阶段出现在星海中央，打掉第三阶段出现箭头进入街巷` and so on.
 *
 * Reuse, not new machinery:
 *   - the phase ladder already fires `BOSS_PHASE_CLEAR_EVENT` with the cleared index,
 *   - the boss is ONE entity across all five phases, so "she appears in the star sea" is a
 *     position change, not a spawn,
 *   - the player is one Matter body, so "walk into the arrow" is a distance check plus a
 *     `setPosition`.
 *
 * The geometry and the grouping live in `@/lib/bosses/arena`; this class only sequences them.
 */

import { EventBus } from '@/lib/events/bus';
import { BOSS_PHASE_CLEAR_EVENT } from '@/lib/bosses/phase-reward';

/** What `advancePhase` puts on the wire - see monster.ts. */
interface BossPhaseClearPayload {
    id?: string;
    /** Zero-based index of the phase that just emptied. */
    clearedIndex?: number;
    /** How many rungs this boss has; the grouping depends on it. */
    phaseCount?: number;
}
import {
    ARROW_RADIUS_PX,
    NEXT_PHASE_DELAY_MS,
    arenaBlocks,
    arrivalPoint,
    arrowDueAfter,
    arrowPoint,
    bossSpawnPoint,
} from '@/lib/bosses/arena';
import type { ArenaBlock } from '@/lib/bosses/arena';

/** The arrow's on-screen body, injected so the loop can be tested without Phaser. */
export interface ArenaArrow {
    destroy(): void;
    setDepth?(depth: number): void;
}

export interface ArenaLoopDeps {
    imageSize: { width: number; height: number };
    /** How many phases this boss has - the grouping depends on it. */
    phaseCount: number;
    /** Move the player's body (and let the camera follow). */
    movePlayer: (x: number, y: number) => void;
    /** Move the boss's body to the middle of the next block. */
    moveBoss: (x: number, y: number) => void;
    /** Draw the arrow. */
    createArrow: (x: number, y: number) => ArenaArrow;
    /** Floor test, so the landing point never drops the player inside a wall. */
    isFree?: (x: number, y: number) => boolean;
    /** Per-block boss spawn points, in walk order; the level authors these. */
    bossSpawns?: readonly { x: number; y: number }[] | null;
    /** Injected clock, ms. */
    now?: () => number;
}

export class BossArenaLoop {
    private readonly deps: ArenaLoopDeps;
    private readonly blocks: ArenaBlock[];
    private readonly now: () => number;
    private arrow: ArenaArrow | null = null;
    private arrowAt: { x: number; y: number } | null = null;
    /** The block the player is fighting in. */
    private blockIndex = 0;
    /** Where the boss should appear, and when. */
    private pendingBossAt: number | null = null;
    private pendingBossPoint: { x: number; y: number } | null = null;
    private listener: (payload?: BossPhaseClearPayload) => void;

    constructor(deps: ArenaLoopDeps) {
        this.deps = deps;
        this.blocks = arenaBlocks(deps.imageSize);
        this.now = deps.now ?? (() => performance.now());
        this.listener = (payload) =>
            this.onPhaseCleared(payload?.clearedIndex, payload?.phaseCount);
        EventBus.on(BOSS_PHASE_CLEAR_EVENT, this.listener);
    }

    /** Read-only, for tests and the debug panel. */
    get currentBlock(): number {
        return this.blockIndex;
    }

    /** Read-only: is an arrow standing on the map right now? */
    get arrowVisible(): boolean {
        return this.arrow !== null;
    }

    get waitingForBoss(): boolean {
        return this.pendingBossAt !== null;
    }

    destroy(): void {
        EventBus.off(BOSS_PHASE_CLEAR_EVENT, this.listener);
        this.arrow?.destroy();
        this.arrow = null;
        this.arrowAt = null;
        this.pendingBossAt = null;
    }

    /**
     * A phase fell. Only the phase that CLOSES a block opens the way: 灭世 leaves no arrow,
     * 神 does, and so on - see `arrowDueAfter`.
     */
    onPhaseCleared(clearedIndex: number | undefined, phaseCount?: number): void {
        if (clearedIndex === undefined) return;
        if (!arrowDueAfter(clearedIndex, phaseCount ?? this.deps.phaseCount)) return;
        const block = this.blocks[this.blockIndex];
        if (!block) return;
        const at = arrowPoint(block);
        this.showArrow(at);
    }

    /**
     * Per frame. Two jobs: the walk-in test, and the two-second wait that brings the boss into
     * the middle of the new block.
     */
    update(player: { x: number; y: number }): void {
        // The boss arrives two seconds after the player did.
        if (this.pendingBossAt !== null && this.pendingBossPoint) {
            if (this.now() >= this.pendingBossAt) {
                this.deps.moveBoss(this.pendingBossPoint.x, this.pendingBossPoint.y);
                this.pendingBossAt = null;
                this.pendingBossPoint = null;
            }
        }

        if (!this.arrowAt) return;
        const distance = Math.hypot(player.x - this.arrowAt.x, player.y - this.arrowAt.y);
        if (distance > ARROW_RADIUS_PX) return;
        this.walkThrough();
    }

    /** Player reached the arrow: land them in the next block, and book the boss's entrance. */
    private walkThrough(): void {
        const next = this.blocks[this.blockIndex + 1];
        if (!next) {
            this.hideArrow();
            return;
        }
        this.blockIndex += 1;
        this.hideArrow();

        const landing = arrivalPoint(next, this.deps.isFree);
        this.deps.movePlayer(landing.x, landing.y);

        // `过两秒第三阶段出现在星海中央` - the wait is the owner's, the point is the block centre.
        this.pendingBossPoint = bossSpawnPoint(next, this.deps.bossSpawns);
        this.pendingBossAt = this.now() + NEXT_PHASE_DELAY_MS;


    }

    private showArrow(at: { x: number; y: number }): void {
        this.arrow?.destroy();
        this.arrow = this.deps.createArrow(at.x, at.y);
        this.arrowAt = at;
    }

    private hideArrow(): void {
        this.arrow?.destroy();
        this.arrow = null;
        this.arrowAt = null;
    }
}