/**
 * tests/game/monsters/last-monster-pointer.test.ts
 * --------------------------------------------------------------------------
 * Three or fewer: the arrow points at them.
 *
 * The owner: `剩余怪物数<=3时复用箭头指引逻辑，指引最后一波怪物在哪里`.
 *
 * Rules worth pinning down:
 *   - it appears at 2 and below, never above;
 *   - it points at the NEAREST one, not the first in the list;
 *   - it disappears the moment the map is clear - a pointer to nothing is worse than none;
 *   - it sits on a ring around the player, so it never covers the fight.
 */

import { describe, expect, it } from 'vitest';

import { LastMonsterPointer, POINTER_RADIUS_PX } from '@/game/monsters/last-monster-pointer';
import { nearestMonster } from '@/lib/monsters/remaining';

interface Drawn {
    x: number;
    y: number;
    angle: number;
    destroyed: boolean;
}

function harness(monsters: () => { x: number; y: number; dead?: boolean; state?: string }[]) {
    const drawn: Drawn[] = [];
    const player = { x: 1000, y: 1000 };
    const pointer = new LastMonsterPointer({
        scene: {} as never,
        getPlayer: () => player,
        getMonsters: monsters,
        createArrow: () => {
            const record: Drawn = { x: 0, y: 0, angle: 0, destroyed: false };
            drawn.push(record);
            return {
                setPosition: (x, y) => {
                    record.x = x;
                    record.y = y;
                },
                setAngle: (a) => {
                    record.angle = a;
                },
                destroy: () => {
                    record.destroyed = true;
                },
            };
        },
    });
    return { pointer, drawn, player };
}

const at = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ x, y, ...extra });

describe('when it appears', () => {
    it('stays hidden while there are more than three', () => {
        const h = harness(() => [at(0, 0), at(0, 100), at(100, 0), at(50, 50)]);
        h.pointer.update();
        expect(h.pointer.visible).toBe(false);
        expect(h.drawn).toHaveLength(0);
    });

    it('appears at exactly three', () => {
        const h = harness(() => [at(0, 0), at(0, 100), at(100, 0)]);
        h.pointer.update();
        expect(h.pointer.visible).toBe(true);
    });

    it('appears at one', () => {
        const h = harness(() => [at(1500, 1000)]);
        h.pointer.update();
        expect(h.pointer.visible).toBe(true);
    });

    it('vanishes when the map is clear', () => {
        const monsters: { x: number; y: number }[] = [at(1500, 1000)];
        const h = harness(() => monsters);
        h.pointer.update();
        expect(h.pointer.visible).toBe(true);

        monsters.length = 0;
        h.pointer.update();
        expect(h.pointer.visible).toBe(false);
        expect(h.drawn[0].destroyed).toBe(true);
    });

    it('ignores the dying - they are already beaten', () => {
        const h = harness(() => [at(1500, 1000, { state: 'dying' }), at(1600, 1000, { state: 'dying' })]);
        h.pointer.update();
        expect(h.pointer.visible).toBe(false);
    });
});

describe('where it points', () => {
    it('aims at the nearest of the two', () => {
        // 1000,1000 player. One monster due east, one far west.
        const h = harness(() => [at(1300, 1000), at(-400, 1000)]);
        h.pointer.update();
        const a = h.drawn[0].angle;
        expect(Math.abs(a)).toBeLessThan(0.01); // due east
    });

    it('sits on a ring around the player, not on the monster', () => {
        const h = harness(() => [at(2000, 1000)]);
        h.pointer.update();
        const d = h.drawn[0];
        expect(Math.hypot(d.x - h.player.x, d.y - h.player.y)).toBeCloseTo(POINTER_RADIUS_PX, 0);
    });

    it('follows the player as they move', () => {
        const h = harness(() => [at(2000, 1000)]);
        h.pointer.update();
        const first = { x: h.drawn[0].x, y: h.drawn[0].y };
        h.player.x = 400;
        h.player.y = 400;
        h.pointer.update();
        expect(h.drawn[0].x).not.toBe(first.x);
        expect(h.drawn[0].y).not.toBe(first.y);
    });
});

describe('nearestMonster', () => {
    it('is null with nothing alive', () => {
        expect(nearestMonster({ x: 0, y: 0 }, [])).toBeNull();
        expect(nearestMonster({ x: 0, y: 0 }, [at(5, 5, { dead: true })])).toBeNull();
    });

    it('returns the distance it used', () => {
        const found = nearestMonster({ x: 0, y: 0 }, [at(3, 4)])!;
        expect(found.distance).toBeCloseTo(5, 6);
    });
});