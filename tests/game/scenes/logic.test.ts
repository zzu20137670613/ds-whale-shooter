/**
 * tests/game/scenes/logic.test.ts
 * --------------------------------------------------------------------------
 * The "is the spawn already inside a portal" decision, tested on its own so
 * the teleporter controller can stay Phaser-bound.
 */
import { describe, expect, it } from 'vitest';

import { portalsContaining } from '@/game/scenes/logic';

/** A portal spec, shaped like the YAML `teleporters:` entries. */
function portal(id: string | undefined, x: number, y: number, radius?: number) {
    return { id, x, y, radius };
}

describe('portalsContaining', () => {
    it('reports the portal sunlit-henge spawns inside', () => {
        // The real numbers from `public/data/levels/sunlit-henge.yaml`:
        // spawn (1366, 541), return portal (1375, 544) radius 50 — 9.5px apart,
        // which is why entering that level used to teleport the player at once.
        const spawn = { x: 1366, y: 541 };
        expect(portalsContaining(spawn, [portal('teleporter-msfpy6pw', 1375, 544, 50)])).toEqual([
            'teleporter-msfpy6pw',
        ]);
    });

    it('ignores portals the player is standing outside', () => {
        expect(portalsContaining({ x: 100, y: 100 }, [portal('far', 900, 900, 60)])).toEqual([]);
    });

    it('treats the radius itself as inside', () => {
        expect(portalsContaining({ x: 0, y: 0 }, [portal('edge', 0, 40, 40)])).toEqual(['edge']);
    });

    it('falls back to a 40px radius when the spec omits one', () => {
        const inside = portalsContaining({ x: 0, y: 0 }, [portal('near', 30, 0)]);
        const outside = portalsContaining({ x: 0, y: 0 }, [portal('near', 50, 0)]);
        expect(inside).toEqual(['near']);
        expect(outside).toEqual([]);
    });

    it('skips portals with no id, which the cooldown cannot hold', () => {
        expect(portalsContaining({ x: 0, y: 0 }, [portal(undefined, 0, 0, 60)])).toEqual([]);
    });

    it('reports every portal the spawn overlaps', () => {
        const portals = [portal('a', 0, 0, 60), portal('b', 80, 0, 60), portal('c', 900, 900, 60)];
        expect(portalsContaining({ x: 40, y: 0 }, portals)).toEqual(['a', 'b']);
    });

    it('reports nothing when a level has no portals', () => {
        expect(portalsContaining({ x: 500, y: 500 }, [])).toEqual([]);
    });
});