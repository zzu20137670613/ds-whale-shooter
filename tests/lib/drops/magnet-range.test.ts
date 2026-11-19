import { describe, expect, it } from 'vitest';

import { DROP_CONFIG, RENDER_VIEW_HEIGHT, RENDER_VIEW_WIDTH } from '@/lib/constants';

/**
 * The invariant that makes skipping off-screen drops safe.
 *
 * DropController.update does exactly two things, and both are gated on the
 * player's distance: the magnet engages inside MAGNET.RADIUS, and the pickup
 * fires inside MAGNET.PICKUP_DISTANCE. The player always sits inside the camera
 * view, so a drop outside that view is only reachable if the magnet's total
 * reach is at least half a viewport — which is what this pins down.
 *
 * If the magnet is ever tuned past half a screen, camera-proximity activation
 * would silently start dropping pickups. The failure surfaces here instead.
 */
describe('drop magnet reach', () => {
    it('is shorter than half a viewport, so off-screen drops are unreachable', () => {
        const reach = DROP_CONFIG.MAGNET.RADIUS + DROP_CONFIG.MAGNET.PICKUP_DISTANCE;
        expect(reach).toBeLessThan(RENDER_VIEW_WIDTH / 2);
        expect(reach).toBeLessThan(RENDER_VIEW_HEIGHT / 2);
    });
});