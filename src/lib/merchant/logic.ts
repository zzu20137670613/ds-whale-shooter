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
 * She stands on the middle of the map (`神秘商人放在地图正中心`), which used to mean
 * "the level is four painted blocks and the centre is their junction". After the 2x2
 * split a painted level is ONE block, so the blocks no longer say anything: the common
 * property is that the level fields waves. Places with no fight (tavern, beach, dev
 * cabin, the hidden map) still never spawn her.
 */
export function usesMerchant(level: {
    spawner?: unknown;
    backgroundBlocks?: readonly unknown[];
}): boolean {
    return Boolean(level.spawner);
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
