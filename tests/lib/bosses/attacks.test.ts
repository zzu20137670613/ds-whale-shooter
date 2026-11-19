/**
 * tests/lib/bosses/attacks.test.ts
 * --------------------------------------------------------------------------
 * The four attacks' shapes, pinned to `boss-神Claude-机制总表.md`.
 *
 * These are geometry tests, not scene tests: nine bullets with the right angular
 * spread, sixteen barrage angles in two offset rings, wrath circles that never stack
 * on top of each other. If a number here drifts, the fight changes shape.
 */

import { describe, expect, it } from 'vitest';

import {
    BARRAGE_RINGS,
    BOSS_MELEE_REACH,
    BARRAGE_SECTORS,
    BOSS_ATTACKS,
    BOSS_BULLET_SIZE_MULTIPLIER,
    BOSS_BULLET_SPEED_MULTIPLIER,
    CANNON_BULLETS_PER_SHOT,
    CANNON_FANG_SPREAD_DEG,
    CANNON_SHOTS,
    WRATH_BASE_RADIUS,
    WRATH_CIRCLES,
    WRATH_CIRCLES_LOW_HP,
    WRATH_FUSE_MS,
    barrageAngles,
    cannonVolley,
    wrathPositions,
} from '@/lib/bosses/attacks';

const toDegrees = (radians: number) => (radians * 180) / Math.PI;

describe('the bullets themselves', () => {
    it('are twice the player size at three quarters speed', () => {
        expect(BOSS_BULLET_SIZE_MULTIPLIER).toBe(2);
        // Half was too slow to cross the ruins: the owner could stand still and never be hit.
        expect(BOSS_BULLET_SPEED_MULTIPLIER).toBe(0.75);
    });
});

describe('三连炮', () => {
    it('fires three shots of three bullets', () => {
        expect(CANNON_SHOTS).toBe(3);
        expect(CANNON_BULLETS_PER_SHOT).toBe(3);
    });

    it('puts one bullet on the aim line and two fangs either side', () => {
        const aim = Math.PI / 2; // straight down
        const angles = cannonVolley(aim);

        expect(angles).toHaveLength(3);
        expect(angles[1]).toBeCloseTo(aim, 10);
        expect(toDegrees(angles[0] - aim)).toBeCloseTo(-CANNON_FANG_SPREAD_DEG, 6);
        expect(toDegrees(angles[2] - aim)).toBeCloseTo(CANNON_FANG_SPREAD_DEG, 6);
    });

    it('is symmetric around the aim, so a moving aim does not skew the fan', () => {
        for (const aim of [0, 0.3, 1.2, -2.4, Math.PI]) {
            const angles = cannonVolley(aim);
            expect(angles[0] + angles[2]).toBeCloseTo(aim * 2, 10);
        }
    });

    it('a full volley is nine bullets', () => {
        const bullets = CANNON_SHOTS * CANNON_BULLETS_PER_SHOT;
        expect(bullets).toBe(9);
    });
});

describe('漫天轰炸', () => {
    it('is two rings of eight', () => {
        expect(BARRAGE_RINGS).toBe(2);
        expect(BARRAGE_SECTORS).toBe(8);
        expect(barrageAngles()).toHaveLength(16);
    });

    it('covers every direction exactly once per ring', () => {
        const angles = barrageAngles();
        const first = angles.slice(0, BARRAGE_SECTORS);
        const second = angles.slice(BARRAGE_SECTORS);

        const normalise = (angle: number) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        expect(new Set(first.map((angle) => normalise(angle).toFixed(6))).size).toBe(8);
        expect(new Set(second.map((angle) => normalise(angle).toFixed(6))).size).toBe(8);
    });

    it('offsets the second ring by half a sector', () => {
        const angles = barrageAngles();
        expect(toDegrees(angles[BARRAGE_SECTORS])).toBeCloseTo(22.5, 6);
    });

    it('rotates clockwise', () => {
        const angles = barrageAngles();
        // Each successive angle in a ring is larger, which is the clockwise sweep the
        // design doc describes (screen coordinates: +y is down).
        for (let i = 1; i < BARRAGE_SECTORS; i += 1) {
            expect(angles[i]).toBeGreaterThan(angles[i - 1]);
        }
    });
});

describe('天谴', () => {
    it('is three circles, five under half health, two seconds of fuse', () => {
        expect(WRATH_CIRCLES).toBe(3);
        expect(WRATH_CIRCLES_LOW_HP).toBe(5);
        // +1s on the owner's call: 0.5s more blue warning, 0.5s more red.
        expect(WRATH_FUSE_MS).toBe(2000);
        expect(WRATH_BASE_RADIUS).toBeGreaterThan(0);
    });

    it('lands the requested number of circles', () => {
        const player = { x: 100, y: 200 };
        expect(wrathPositions(player, 3, Math.random)).toHaveLength(3);
        expect(wrathPositions(player, 5, Math.random)).toHaveLength(5);
    });

    it('never stacks two circles on the same spot', () => {
        // One circle per sector: with a constant random the sector is what separates
        // them, so this fails loudly if the sector logic is ever removed.
        const player = { x: 0, y: 0 };
        const points = wrathPositions(player, 3, () => 0.5);
        const distances = points.map((point, i) =>
            i === 0
                ? Infinity
                : Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y),
        );
        for (const gap of distances) {
            expect(gap).toBeGreaterThan(10);
        }
    });

    it('keeps the circles near the player, not on the far side of the map', () => {
        const player = { x: 500, y: 500 };
        for (const point of wrathPositions(player, 5, Math.random)) {
            const distance = Math.hypot(point.x - player.x, point.y - player.y);
            expect(distance).toBeLessThanOrEqual(151);
            expect(distance).toBeGreaterThanOrEqual(47);
        }
    });
});

describe('the damage table', () => {
    it('matches the locked numbers', () => {
        expect(BOSS_ATTACKS['triple-cannon'].damage).toBe(130);
        expect(BOSS_ATTACKS.melee.damage).toBe(140);
        expect(BOSS_ATTACKS.wrath.damage).toBe(180);
    });

    it('hits as hard per bullet as the cannon does', () => {
        // The owner's rule: the barrage is the same shell, fired from every direction.
        expect(BOSS_ATTACKS.barrage.damage).toBe(BOSS_ATTACKS['triple-cannon'].damage);
    });

    it('gives every attack a windup, so none of them is instant', () => {
        for (const [id, spec] of Object.entries(BOSS_ATTACKS)) {
            expect(spec.windupMs, id).toBeGreaterThan(0);
        }
    });
});
describe('melee reach', () => {
    it('is arm\'s length, not the weapon range', () => {
        // Her mortar reaches 700. A swing must not, or she swings across the room.
        expect(BOSS_MELEE_REACH).toBe(96);
        expect(BOSS_MELEE_REACH).toBeLessThan(700);
    });
});
