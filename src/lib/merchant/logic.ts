/**
 * src/lib/merchant/logic.ts
 * --------------------------------------------------------------------------
 * Pure decisions for the mysterious merchant, shared by the scene glue and
 * the tests. No Phaser in here.
 */

/**
 * Event the merchant fires when clicked. The React layer owns what that
 * means (it hands the player back to the tavern, i.e. character select);
 * the scene only announces the click.
 */
export const MERCHANT_RETURN_EVENT = 'merchant-return-to-tavern';

/**
 * Does this level host the merchant?
 *
 * Only the four-block painted worlds do — the levels assembled out of
 * `backgroundBlocks`, whose centre point is the junction of four painted
 * screens. Single-image levels (tavern, beach, henge) never spawn her,
 * because they have no junction to stand on.
 */
export function usesMerchant(level: {
    backgroundBlocks?: readonly unknown[];
}): boolean {
    return (level.backgroundBlocks?.length ?? 0) > 0;
}

/**
 * The merchant stands exactly on the junction of the four painted blocks,
 * which is the centre of the world image.
 */
export function merchantSpawnPosition(imageSize: {
    width: number;
    height: number;
}): { x: number; y: number } {
    return {
        x: Math.round(imageSize.width / 2),
        y: Math.round(imageSize.height / 2),
    };
}