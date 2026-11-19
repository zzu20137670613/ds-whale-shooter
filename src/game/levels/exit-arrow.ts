/**
 * src/game/levels/exit-arrow.ts
 * --------------------------------------------------------------------------
 * "The way out is that way", shown only when the map is actually clear.
 *
 * The owner: `全部打掉后复用boss战的箭头逻辑，指向王座前往boss战`. The arrow is the same one the
 * boss walk uses (`createArenaArrow`) - one shape, learned once - and the walk-in itself is left
 * to the level's own travel trigger, so there is exactly one code path into the boss fight.
 */

import { ARROW_RADIUS_PX } from '@/lib/bosses/arena';
import { createArenaArrow } from '@/game/bosses/arena-arrow';
import type { ArenaArrowHandle } from '@/game/bosses/arena-arrow';

export interface ExitArrowDeps {
    scene: Phaser.Scene;
    at: { x: number; y: number };
    direction: 'up' | 'down' | 'left' | 'right';
    /** True once the level's waves are all done. Polled; the arrow appears on the first true. */
    isClear: () => boolean;
    /** Optional: called the first time the player walks into the arrow. */
    onEnter?: () => void;
    /** Injected in tests; the real one draws chevrons. */
    createArrow?: (x: number, y: number, direction: ExitArrowDeps['direction']) => ArenaArrowHandle;
}

export class ExitArrow {
    private readonly deps: ExitArrowDeps;
    private handle: ArenaArrowHandle | null = null;
    private entered = false;

    constructor(deps: ExitArrowDeps) {
        this.deps = deps;
    }

    get visible(): boolean {
        return this.handle !== null;
    }

    update(player: { x: number; y: number }): void {
        if (!this.handle) {
            if (!this.deps.isClear()) return;
            const draw = this.deps.createArrow ?? ((x, y, dir) => createArenaArrow(this.deps.scene, x, y, dir));
            this.handle = draw(this.deps.at.x, this.deps.at.y, this.deps.direction);
        }

        if (this.entered) return;
        const distance = Math.hypot(player.x - this.deps.at.x, player.y - this.deps.at.y);
        if (distance > ARROW_RADIUS_PX) return;
        this.entered = true;
        this.deps.onEnter?.();
    }

    destroy(): void {
        this.handle?.destroy();
        this.handle = null;
    }
}