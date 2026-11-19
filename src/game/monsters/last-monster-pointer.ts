/**
 * src/game/monsters/last-monster-pointer.ts
 * --------------------------------------------------------------------------
 * "Three or fewer, and one of them is hiding" - the arrow that says where.
 *
 * The owner: `剩余怪物数<=3时复用箭头指引逻辑，指引最后一波怪物在哪里`. Same chevrons as the boss
 * walk (one shape, learned once), but this one orbits the player and points at the nearest
 * remaining monster, re-aimed every frame because the target is moving.
 *
 * It only exists while there is something to point at: above the threshold, or with the map
 * clear, it destroys itself and stays quiet.
 */

import { POINTER_THRESHOLD, nearestMonster } from '@/lib/monsters/remaining';
import type { PointerArrowHandle } from '@/game/bosses/arena-arrow';
import { createPointerArrow } from '@/game/bosses/arena-arrow';

/** How far from the player the arrow sits. */
export const POINTER_RADIUS_PX = 120;

export interface LastMonsterPointerDeps {
    scene: Phaser.Scene;
    /** Where the player is right now. */
    getPlayer: () => { x: number; y: number };
    /** Every monster on the map, with the flags `nearestMonster` cares about. */
    getMonsters: () => readonly {
        x: number;
        y: number;
        dead?: boolean;
        state?: string;
        spec?: { prop?: boolean };
    }[];
    /** Injected in tests. */
    createArrow?: (scene: Phaser.Scene) => PointerArrowHandle;
    threshold?: number;
}

export class LastMonsterPointer {
    private readonly deps: LastMonsterPointerDeps;
    private arrow: PointerArrowHandle | null = null;

    constructor(deps: LastMonsterPointerDeps) {
        this.deps = deps;
    }

    get visible(): boolean {
        return this.arrow !== null;
    }

    update(): void {
        const threshold = this.deps.threshold ?? POINTER_THRESHOLD;
        const player = this.deps.getPlayer();
        const monsters = this.deps.getMonsters();
        const target = nearestMonster(player, monsters);

        // Nothing to point at, or too many to be worth pointing at.
        if (!target || monsters.filter((m) => !m.dead && m.state !== 'dying' && !m.spec?.prop).length > threshold) {
            this.hide();
            return;
        }

        if (!this.arrow) {
            const create = this.deps.createArrow ?? createPointerArrow;
            this.arrow = create(this.deps.scene);
        }

        // A ring around the player, aimed at the target. Straight up when they overlap, so the
        // arrow does not flicker between random angles at zero distance.
        const angle = target.distance > 1 ? Math.atan2(target.y - player.y, target.x - player.x) : -Math.PI / 2;
        this.arrow.setPosition(
            player.x + Math.cos(angle) * POINTER_RADIUS_PX,
            player.y + Math.sin(angle) * POINTER_RADIUS_PX,
        );
        this.arrow.setAngle(angle);
    }

    destroy(): void {
        this.hide();
    }

    private hide(): void {
        this.arrow?.destroy();
        this.arrow = null;
    }
}