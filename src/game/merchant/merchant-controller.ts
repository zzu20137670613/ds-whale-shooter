/**
 * src/game/merchant/merchant-controller.ts
 * --------------------------------------------------------------------------
 * The mysterious merchant.
 *
 * She stands on the junction of the four painted blocks and only shows up
 * once the level's monsters are cleared. She carries the **tavern shop**
 * now: clicking her opens the shop panel in the React layer, and the shop no
 * longer exists in the seaside pavilion.
 *
 * This module owns *how* she appears — texture, shadow, depth sorting,
 * click wiring, teardown — and publishes `merchantReady` so the HUD knows
 * the shop is available. Callers (LoadScene) only decide *whether* she
 * exists in this level.
 */

import Phaser from 'phaser';

import { MERCHANT_DISPLAY_HEIGHT, MERCHANT_TEXTURE_KEY } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { MERCHANT_SHOP_EVENT, merchantSpawnPosition } from '@/lib/merchant/logic';
import { useGameStore } from '@/store/game-store';

export class MerchantController {
    private sprite?: Phaser.GameObjects.Sprite;
    private shadow?: Phaser.GameObjects.Ellipse;

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
        if (this.sprite) return;
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
        sprite.on('pointerdown', () => this.openShop());

        this.sprite = sprite;
        useGameStore.getState().setMerchantReady(true);
    }

    /** The tavern shop's old job, now hers. */
    private openShop(): void {
        EventBus.emit(MERCHANT_SHOP_EVENT);
    }

    destroy(): void {
        this.scene.events.off('update', this.update, this);
        this.sprite?.destroy();
        this.shadow?.destroy();
        this.sprite = undefined;
        this.shadow = undefined;
        // The new scene announces her again if it hosts her; until then the
        // shop button must not be on screen.
        useGameStore.getState().setMerchantReady(false);
    }
}