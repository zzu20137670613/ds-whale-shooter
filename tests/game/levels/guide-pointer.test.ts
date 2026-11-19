/**
 * tests/game/levels/guide-pointer.test.ts
 * --------------------------------------------------------------------------
 * The arrow to Atlantis's throne rides beside the player.
 *
 * The owner: `亚特兰蒂斯最终指向王座的箭头不应该是在地图上的，应该与最后三只怪的箭头一样，是在
 * 玩家角色旁边进行指路的`.
 *
 * A world-placed arrow is a signpost you can walk past without noticing. This one is
 * attached to the player at the same radius as the last-monster pointer, so the two read
 * as one language.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GuidePointer } from '@/game/levels/guide-pointer';
import { POINTER_RADIUS_PX } from '@/game/monsters/last-monster-pointer';
import { parseLevelYaml } from '@/lib/levels/parser';

const THRONE = { x: 2644, y: 1690 };

function harness(active = true) {
    const drawn: { x: number; y: number; angle: number; destroyed: boolean }[] = [];
    const player = { x: 4000, y: 3000 };
    let on = active;
    const pointer = new GuidePointer({
        scene: {} as never,
        getPlayer: () => player,
        target: THRONE,
        isActive: () => on,
        createArrow: () => {
            const record = { x: 0, y: 0, angle: 0, destroyed: false };
            drawn.push(record);
            return {
                setPosition: (x: number, y: number) => {
                    record.x = x;
                    record.y = y;
                },
                setAngle: (a: number) => {
                    record.angle = a;
                },
                destroy: () => {
                    record.destroyed = true;
                },
            };
        },
    });
    return {
        pointer,
        drawn,
        player,
        setActive: (v: boolean) => {
            on = v;
        },
    };
}

describe('when it shows', () => {
    it('stays hidden until the map is cleared', () => {
        const h = harness(false);
        h.pointer.update();
        expect(h.pointer.visible).toBe(false);
        expect(h.drawn).toHaveLength(0);
    });

    it('appears once cleared', () => {
        const h = harness(true);
        h.pointer.update();
        expect(h.pointer.visible).toBe(true);
    });

    it('disappears again if the state flips back', () => {
        const h = harness(true);
        h.pointer.update();
        h.setActive(false);
        h.pointer.update();
        expect(h.pointer.visible).toBe(false);
        expect(h.drawn[0].destroyed).toBe(true);
    });
});

describe('where it points', () => {
    it('aims at the throne', () => {
        const h = harness();
        h.pointer.update();
        const expected = Math.atan2(THRONE.y - h.player.y, THRONE.x - h.player.x);
        expect(h.drawn[0].angle).toBeCloseTo(expected, 5);
    });

    it('sits on the same ring as the last-monster arrow', () => {
        const h = harness();
        h.pointer.update();
        expect(Math.hypot(h.drawn[0].x - h.player.x, h.drawn[0].y - h.player.y)).toBeCloseTo(
            POINTER_RADIUS_PX,
            0,
        );
    });

    it('follows the player', () => {
        const h = harness();
        h.pointer.update();
        const first = { x: h.drawn[0].x, y: h.drawn[0].y };
        h.player.x = 100;
        h.player.y = 100;
        h.pointer.update();
        expect(h.drawn[0].x).not.toBe(first.x);
    });
});

describe('the Atlantis level', () => {
    const level = parseLevelYaml(
        readFileSync(join(process.cwd(), 'public', 'data', 'levels', 'dsh-atlantis-4-coronation-dais.yaml'), 'utf8'),
        'dsh-atlantis-4-coronation-dais',
    );

    it('asks for the orbiting style', () => {
        expect(level.exitArrow?.orbit).toBe(true);
    });

    it('still names the throne as the target', () => {
        expect(level.exitArrow?.x).toBe(2644);
        expect(level.exitArrow?.y).toBe(1690);
    });
});