import { describe, expect, it } from 'vitest';

import { DEFAULT_ACTIVATION_MARGIN, isWithinView } from '@/lib/props/activation';

/** The camera's view in world coordinates, as `camera.worldView` reports it. */
const VIEW = { left: 1000, top: 500, right: 3752, bottom: 2036 };

function box(x: number, y: number, halfWidth = 0, halfHeight = 0) {
    return { x, y, halfWidth, halfHeight };
}

describe('isWithinView', () => {
    it('keeps an object the camera is looking at', () => {
        expect(isWithinView(box(2000, 1000), VIEW)).toBe(true);
    });

    it('drops an object a screen away on each axis', () => {
        expect(isWithinView(box(2000, 1000 - 4000), VIEW)).toBe(false);
        expect(isWithinView(box(2000, 1000 + 4000), VIEW)).toBe(false);
        expect(isWithinView(box(1000 - 6000, 1000), VIEW)).toBe(false);
        expect(isWithinView(box(1000 + 6000, 1000), VIEW)).toBe(false);
    });

    it('counts a box that only touches the boundary', () => {
        // Inclusive on purpose: at exactly the margin the object is still
        // active, so there is no one-frame hole right at the edge.
        expect(isWithinView(box(VIEW.left - DEFAULT_ACTIVATION_MARGIN, 1000), VIEW)).toBe(true);
        expect(isWithinView(box(VIEW.left - DEFAULT_ACTIVATION_MARGIN - 1, 1000), VIEW)).toBe(false);
    });

    it('keeps a tall object whose art overhangs the view', () => {
        // A palm is anchored at its trunk: the anchor can sit well below the
        // camera while the fronds are still on screen.
        expect(isWithinView(box(2000, VIEW.bottom + 200, 90, 300), VIEW)).toBe(true);
    });

    it('uses the box, not just the anchor', () => {
        const overhanging = box(2000, VIEW.bottom + 701, 90, 700);
        expect(isWithinView(overhanging, VIEW)).toBe(true);
        expect(isWithinView(overhanging, VIEW, 0)).toBe(false);
    });

    it('honours a custom margin', () => {
        const justOffScreen = box(VIEW.right + 300, 1000);
        expect(isWithinView(justOffScreen, VIEW)).toBe(true);
        expect(isWithinView(justOffScreen, VIEW, 100)).toBe(false);
    });

    it('treats margin 0 as the plain view rectangle', () => {
        expect(isWithinView(box(2000, 1000), VIEW, 0)).toBe(true);
        expect(isWithinView(box(VIEW.right + 1, 1000), VIEW, 0)).toBe(false);
    });
});