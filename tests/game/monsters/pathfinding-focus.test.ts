import { describe, expect, it } from 'vitest';

import { PathfindingService } from '@/game/monsters/logic';

type Wall = { points: readonly [number, number][] };

function square(x: number, y: number, width: number, height: number): Wall {
    return {
        points: [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
        ],
    };
}

/** A camera-sized rect. */
const VIEW = { left: 1000, top: 500, right: 3752, bottom: 2036 };

describe('PathfindingService focus', () => {
    it('routes around a wall while the start point is on camera', () => {
        // The wall sits between start and end, so a real A* route must bend —
        // a straight line would be exactly two points.
        const service = new PathfindingService(
            { width: 2752, height: 1536 },
            [square(1400, 400, 200, 600)],
            16,
        );
        service.setFocus(VIEW);

        const path = service.findPath({ x: 1200, y: 700 }, { x: 1800, y: 700 }, 12, 14);

        expect(path).not.toBeNull();
        expect(path!.length).toBeGreaterThan(2);
    });

    it('returns a straight two-point line when the start point is off camera', () => {
        const service = new PathfindingService(
            { width: 24768, height: 13824 },
            [square(20200, 11000, 400, 2000)],
            16,
        );
        service.setFocus(VIEW);

        const start = { x: 20000, y: 12000 };
        const end = { x: 21000, y: 12000 };

        expect(service.findPath(start, end, 12, 14)).toEqual([start, end]);
    });

    it('runs A* again on the same pair once the focus reaches them', () => {
        const service = new PathfindingService(
            { width: 24768, height: 13824 },
            [square(20200, 11000, 400, 2000)],
            16,
        );
        const start = { x: 20000, y: 12000 };
        const end = { x: 21000, y: 12000 };

        service.setFocus(VIEW);
        expect(service.findPath(start, end, 12, 14)).toEqual([start, end]);

        service.setFocus({ left: 19000, top: 10000, right: 22000, bottom: 14000 });
        const path = service.findPath(start, end, 12, 14);
        expect(path!.length).toBeGreaterThan(2);
    });

    it('paths anywhere when no focus has been set', () => {
        const service = new PathfindingService(
            { width: 2752, height: 1536 },
            [square(1400, 400, 200, 600)],
            16,
        );

        const path = service.findPath({ x: 1200, y: 700 }, { x: 1800, y: 700 }, 12, 14);

        expect(path!.length).toBeGreaterThan(2);
    });

    it('still routes around a wall when easystar only gets the camera window', () => {
        // With a focus set, easystar is handed a slice rather than the whole
        // grid, so its coordinates are window-relative and have to be shifted
        // back. The detour must survive that, and no waypoint may end up inside
        // the wall.
        const service = new PathfindingService(
            { width: 2752, height: 1536 },
            [square(1400, 400, 200, 600)],
            16,
        );
        service.setFocus(VIEW);

        const path = service.findPath({ x: 1200, y: 700 }, { x: 1800, y: 700 }, 12, 14);

        expect(path!.length).toBeGreaterThan(2);
        for (const point of path!) {
            const insideWall = point.x > 1400 && point.x < 1600 && point.y > 400 && point.y < 1000;
            expect(insideWall).toBe(false);
        }
    });
});