/**
 * src/game/levels/guide-pointer.ts
 * --------------------------------------------------------------------------
 * A "go there" arrow that rides beside the player instead of sitting on the floor.
 *
 * The owner: `亚特兰蒂斯最终指向王座的箭头不应该是在地图上的，应该与最后三只怪的箭头一样，是在
 * 玩家角色旁边进行指路的`.
 *
 * Same chevrons and the same ring radius as the last-monster pointer, so there is one
 * "this way" language in the game: a world-placed `ExitArrow` is a signpost you might walk
 * past, this one is attached to you and always points at the target.
 */

import { POINTER_RADIUS_PX } from '@/game/monsters/last-monster-pointer';
import type { PointerArrowHandle } from '@/game/bosses/arena-arrow';
import { createPointerArrow } from '@/game/bosses/arena-arrow';

export interface GuidePointerDeps {
    scene: Phaser.Scene;
    /** Where the player is right now. */
    getPlayer: () => { x: number; y: number };
    /** The thing being pointed at - the throne, for Atlantis. */
    target: { x: number; y: number };
    /** Only shown once the map is clear. */
    isActive: () => boolean;
    /** Injected in tests. */
    createArrow?: (scene: Phaser.Scene) => PointerArrowHandle;
    radius?: number;
}

export class GuidePointer {
    private readonly deps: GuidePointerDeps;
    private arrow: PointerArrowHandle | null = null;

    constructor(deps: GuidePointerDeps) {
        this.deps = deps;
    }

    get visible(): boolean {
        return this.arrow !== null;
    }

    update(): void {
        if (!this.deps.isActive()) {
            this.hide();
            return;
        }

        if (!this.arrow) {
            const create = this.deps.createArrow ?? createPointerArrow;
            this.arrow = create(this.deps.scene);
        }

        const player = this.deps.getPlayer();
        const radius = this.deps.radius ?? POINTER_RADIUS_PX;
        const dx = this.deps.target.x - player.x;
        const dy = this.deps.target.y - player.y;
        // Straight up when already on the target, so the arrow does not flicker.
        const angle = Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : -Math.PI / 2;

        this.arrow.setPosition(
            player.x + Math.cos(angle) * radius,
            player.y + Math.sin(angle) * radius,
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