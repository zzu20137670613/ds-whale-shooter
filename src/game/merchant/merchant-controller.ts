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
import { hudFitScale } from '@/game/hubs/base-hub';
import { t } from '@/locales';
import { MERCHANT_SHOP_EVENT, merchantSpawnPosition } from '@/lib/merchant/logic';
import {
    EPILOGUE_CAT_TEXTURE_KEY,
    merchantAndCatPositions,
    type EpilogueCat,
} from '@/lib/story/epilogue-npcs';
import { useGameStore } from '@/store/game-store';

export class MerchantController {
    private sprite?: Phaser.GameObjects.Sprite;
    private shadow?: Phaser.GameObjects.Ellipse;
    private nameLabel?: Phaser.GameObjects.Text;
    private catSprite?: Phaser.GameObjects.Sprite;
    private catShadow?: Phaser.GameObjects.Ellipse;

    /**
     * @param imageSize World size; her spot is its centre.
     * @param isCleared Polled once per frame — every monster and pending
     *                  wave has to be gone before she appears.
     */
    /**
     * @param cat The 创世线 cat for this world, or null before the ending. She stands shoulder
     *            to shoulder with the merchant, at half her height.
     */
    constructor(
        private readonly scene: Phaser.Scene,
        private readonly imageSize: { width: number; height: number },
        private readonly isCleared: () => boolean,
        private readonly cat: EpilogueCat | null = null,
        /** Overrides the map centre; see the level's `merchantAt`. */
        private readonly spawnAt: { x: number; y: number } | null = null,
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

        const junction = this.spawnAt ?? merchantSpawnPosition(this.imageSize);
        const height = MERCHANT_DISPLAY_HEIGHT;

        // Measure the merchant before placing anybody: the cat's berth is defined relative to
        // her own width (`把神秘商人往左移神秘商人宽度的一半`).
        const merchantProbe = this.scene.textures.get(MERCHANT_TEXTURE_KEY).getSourceImage();
        const merchantWidth = (merchantProbe.width * height) / merchantProbe.height;
        const catTexture = this.cat ? EPILOGUE_CAT_TEXTURE_KEY : null;
        const catImage =
            catTexture && this.scene.textures.exists(catTexture)
                ? this.scene.textures.get(catTexture).getSourceImage()
                : null;
        const catHeight = height / 2;
        const catWidth = catImage ? (catImage.width * catHeight) / catImage.height : 0;

        const spots = this.cat
            ? merchantAndCatPositions(junction, merchantWidth, catWidth)
            : { merchant: junction, cat: junction };
        const { x, y } = spots.merchant;

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

        // Her name, floating above her head the same way a character's name
        // floats above its status bar: monospace, white, hard black stroke.
        //
        // The font size is authored in SCREEN pixels, so it is divided by the
        // camera's FIT scale like the status hubs do — otherwise the world
        // zoom shrinks the label along with the map and 18px lands as ~10px.
        const fit = hudFitScale(this.scene) || 1;
        this.nameLabel = this.scene.add
            .text(x, y - height - 10, t('merchant.name'), {
                fontFamily: 'monospace',
                fontSize: '23px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5,
                shadow: {
                    offsetX: 1,
                    offsetY: 1,
                    color: '#000000',
                    blur: 0,
                    stroke: true,
                    fill: true,
                },
            })
            .setResolution(2)
            .setOrigin(0.5, 1);
        this.nameLabel.setScale(1 / fit);
        this.nameLabel.setDepth(y + 1);

        this.sprite = sprite;
        // 创世线: the cat takes the half of her old footprint that her step left free.
        this.spawnCat(spots.cat);
        useGameStore.getState().setMerchantReady(true);
    }

    /**
     * The 创世线 cat: half the merchant's height, standing shoulder to shoulder with her.
     *
     * Her line is the CDK fragment for this world. It is spoken through the ordinary notice
     * banner rather than a bespoke bubble - the player already reads notices there, and a
     * one-off speech UI for three lines is not worth a component.
     */
    private spawnCat(at: { x: number; y: number }): void {
        if (!this.cat) return;
        if (!this.scene.textures.exists(EPILOGUE_CAT_TEXTURE_KEY)) return;

        const height = MERCHANT_DISPLAY_HEIGHT / 2;
        const shadow = this.scene.add.ellipse(
            at.x,
            at.y,
            height * 0.4,
            height * 0.1,
            0x000000,
            0.28,
        );
        shadow.setDepth(at.y - 2);
        this.catShadow = shadow;

        const sprite = this.scene.add.sprite(at.x, at.y, EPILOGUE_CAT_TEXTURE_KEY);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(height / sprite.height);
        sprite.setDepth(at.y);
        sprite.setInteractive();
        const line = this.cat.line;
        sprite.on('pointerdown', () => {
            // The CDK line, verbatim: it is a puzzle, not UI copy, so it is never translated.
            useGameStore.getState().showNotice(line);
        });
        this.catSprite = sprite;
    }

    /** The tavern shop's old job, now hers. */
    private openShop(): void {
        // The cat in the cabin opens the same panel under another name; tapping
        // her must put the normal title back.
        useGameStore.getState().setShopTitle('shop.title');
        EventBus.emit(MERCHANT_SHOP_EVENT);
    }

    destroy(): void {
        this.scene.events.off('update', this.update, this);
        this.sprite?.destroy();
        this.shadow?.destroy();
        this.nameLabel?.destroy();
        this.catSprite?.destroy();
        this.catShadow?.destroy();
        this.catSprite = undefined;
        this.catShadow = undefined;
        this.sprite = undefined;
        this.shadow = undefined;
        this.nameLabel = undefined;
        // The new scene announces her again if it hosts her; until then the
        // shop button must not be on screen.
        useGameStore.getState().setMerchantReady(false);
    }
}
