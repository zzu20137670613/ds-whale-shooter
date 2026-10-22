/**
 * src/lib/merchant/logic.ts
 * --------------------------------------------------------------------------
 * Pure decisions for the mysterious merchant, shared by the scene glue and
 * the tests. No Phaser in here.
 */

/**
 * Event the merchant fires when clicked. The tavern shop lives here now
 * instead of in the seaside pavilion: the React layer opens the shop panel
 * when it hears this.
 */
export const MERCHANT_SHOP_EVENT = 'merchant-open-shop';

/**
 * Event the shop's "return home" button fires. The React layer owns what it
 * means (walk the player to the seaside pavilion, keeping the run); the
 * panel cannot import the Phaser bootstrap itself without dragging the whole
 * engine into the HUD tests.
 */
export const RETURN_TO_PAVILION_EVENT = 'shop-return-to-pavilion';

/**
 * Does this level host the merchant?
 *
 * Only the four-block painted worlds do — the levels assembled out of
 * `backgroundBlocks`, whose centre point is the junction of four painted
 * screens. Single-image levels (tavern, beach, henge) never spawn her,
 * because they have no junction to stand on.
 */
export function usesMerchant(level: { backgroundBlocks?: readonly unknown[] }): boolean {
    return (level.backgroundBlocks?.length ?? 0) > 0;
}

/**
 * The merchant stands exactly on the junction of the four painted blocks,
 * which is the centre of the world image.
 */
export function merchantSpawnPosition(imageSize: { width: number; height: number }): {
    x: number;
    y: number;
} {
    return {
        x: Math.round(imageSize.width / 2),
        y: Math.round(imageSize.height / 2),
    };
}
