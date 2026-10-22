/**
 * src/game/merchant/merchant-controller.ts
 * --------------------------------------------------------------------------
 * The mysterious merchant.
 *
 * She stands on the junction of the four painted blocks and only shows up
 * once the level's monsters are cleared. Clicking her is the level's way
 * out: the scene announces the click on the EventBus and the React layer
 * routes it to `restartAtTavern` (character select), which is exactly what
 * the old tavern button used to do.
 *
 * This module owns *how* she appears — texture, shadow, depth sorting,
 * click wiring, teardown. Callers (LoadScene) only decide *whether* she
 * exists in this level.
 */

import Phaser from 'phaser';

import {
    MERCHANT_DISPLAY_HEIGHT,
    MERCHANT_TEXTURE_KEY,
} from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import {
    MERCHANT_RETURN_EVENT,
    merchantSpawnPosition,
} from '@/lib/merchant/logic';

export class MerchantController {
    private sprite?: Phaser.GameObjects.Sprite;
    private shadow?: Phaser.GameObjects.Ellipse;
    /** Set on first click so a double-tap cannot fire the return twice. */
    private dismissed = false;

    /**
     * @param imageSize World size; her spot is its centre.
     * @param isCleared Polled once per frame — every monster and pending
     *                  wave has to be gone before she appears.
     */
    constructor(
        private readonly scene: Phaser.Scene,
        private readonly imageSize: { width: number; height: number },
        private readonly isCleared: () => boolean,
    ) {
        scene.events.on('update', this.update, this);
        scene.events.once('shutdown', this.destroy, this);
        scene.events.once('destroy', this.destroy, this);
    }

    /** Cheap per-frame gate: nothing to do until the level is clean. */
    private update(): void {
        if (this.sprite || this.dismissed) return;
        if (!this.isCleared()) return;
        this.spawn();
    }

    private spawn(): void {
        if (!this.scene.textures.exists(MERCHANT_TEXTURE_KEY)) return;

        const { x, y } = merchantSpawnPosition(this.imageSize);
        const height = MERCHANT_DISPLAY_HEIGHT;

        // Foot-anchored like every other actor, and depth-sorted by her feet
        // so a player standing south of her draws on top.
        this.shadow = this.scene.add.ellipse(x, y, height * 0.34, height * 0.09, 0x000000, 0.3);
        this.shadow.setDepth(y - 2);

        const sprite = this.scene.add.sprite(x, y, MERCHANT_TEXTURE_KEY);
        sprite.setOrigin(0.5, 1);
        // Scale from the texture's own height so the art's aspect ratio is
        // never duplicated as a magic number here.
        sprite.setScale(height / sprite.height);
        sprite.setDepth(y);
        // No `useHandCursor`: the canvas hides the system cursor and the
        // pixel crosshair is the only pointer (same rule as the tavern NPCs).
        sprite.setInteractive();
        sprite.on('pointerdown', () => this.activate());

        this.sprite = sprite;
    }

    /** Hand the player back to the tavern — the old tavern button's job. */
    private activate(): void {
        if (this.dismissed) return;
        this.dismissed = true;
        EventBus.emit(MERCHANT_RETURN_EVENT);
    }

    destroy(): void {
        this.scene.events.off('update', this.update, this);
        this.sprite?.destroy();
        this.shadow?.destroy();
        this.sprite = undefined;
        this.shadow = undefined;
    }
}