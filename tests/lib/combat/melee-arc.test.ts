/**
 * tests/lib/combat/melee-arc.test.ts
 * --------------------------------------------------------------------------
 * Eight-direction melee. The owner's ask: `方案 A：判定改 8 向`.
 *
 * The bug being locked down: the swing VISUAL already rotated with the aim
 * (`g.setRotation(opts.angle)`), but the sensor rectangle did not - `y` was
 * pinned to the attacker's row and the box never rotated, so only left and
 * right ever connected.
 */

import { describe, expect, it } from 'vitest';

import {
    MELEE_SECTORS,
    meleeHitboxPlacement,
    snapMeleeAngle,
} from '@/lib/combat/melee-arc';

const DEG = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => Math.round((radians * 180) / Math.PI);

describe('snapping an aim to eight sectors', () => {
    it('has eight sectors', () => {
        expect(MELEE_SECTORS).toBe(8);
    });

    it('keeps an exact aim on its own sector', () => {
        // Canonical angles are (-180, 180], so 225 / 315 come back negative.
        const cases: [number, number][] = [
            [0, 0],
            [45, 45],
            [90, 90],
            [135, 135],
            [180, 180],
            [225, -135],
            [270, -90],
            [315, -45],
        ];
        for (const [aim, expected] of cases) {
            expect(deg(snapMeleeAngle(DEG(aim))), `${aim} deg`).toBe(expected);
        }
    });

    it('rounds to the nearest sector, not the floor', () => {
        expect(deg(snapMeleeAngle(DEG(20)))).toBe(0);
        expect(deg(snapMeleeAngle(DEG(25)))).toBe(45);
        expect(deg(snapMeleeAngle(DEG(70)))).toBe(90);
        expect(deg(snapMeleeAngle(DEG(-20)))).toBe(0);
        expect(deg(snapMeleeAngle(DEG(-70)))).toBe(-90);
    });

    it('wraps negative and over-full turns into a canonical angle', () => {
        // -45 and 315 are the same direction; both must read the same.
        expect(deg(snapMeleeAngle(DEG(-45)))).toBe(deg(snapMeleeAngle(DEG(315))));
        // Three full turns plus a right aim is still a right aim.
        expect(deg(snapMeleeAngle(DEG(360 * 3)))).toBe(0);
    });

    it('survives a corrupt angle', () => {
        expect(snapMeleeAngle(Number.NaN)).toBe(0);
    });
});

describe('placing the hit box', () => {
    const origin = { x: 100, y: 200 };
    const range = 120;
    const hitWidth = 60;

    it('reaches the full range along the swing direction', () => {
        // The far edge sits at `range` from the origin on the swing line.
        for (const degrees of [0, 45, 90, 135, -45, -90]) {
            const placement = meleeHitboxPlacement(origin, DEG(degrees), range, hitWidth);
            const distance = Math.hypot(placement.x - origin.x, placement.y - origin.y);
            expect(distance, `at ${degrees} deg`).toBeCloseTo(range - hitWidth / 2, 5);
            expect(deg(placement.angle)).toBe(degrees);
        }
    });

    it('moves the box up and down, which the old code never did', () => {
        const up = meleeHitboxPlacement(origin, DEG(-90), range, hitWidth);
        const down = meleeHitboxPlacement(origin, DEG(90), range, hitWidth);
        expect(up.x).toBeCloseTo(origin.x, 5);
        expect(up.y).toBeLessThan(origin.y);
        expect(down.y).toBeGreaterThan(origin.y);
    });

    it('sends a diagonal swing up-right and down-right', () => {
        // Screen space: +y is DOWN, so -45 aims up-right and +45 down-right.
        const upRight = meleeHitboxPlacement(origin, DEG(-45), range, hitWidth);
        expect(upRight.x).toBeGreaterThan(origin.x);
        expect(upRight.y).toBeLessThan(origin.y);

        const downRight = meleeHitboxPlacement(origin, DEG(45), range, hitWidth);
        expect(downRight.x).toBeGreaterThan(origin.x);
        expect(downRight.y).toBeGreaterThan(origin.y);
    });

    it('never folds a long weapon back onto the body', () => {
        // range shorter than half the box: the box stays centred, unchanged.
        const placement = meleeHitboxPlacement(origin, 0, 10, 80);
        expect(placement.x).toBe(origin.x);
        expect(placement.y).toBe(origin.y);
    });
});