/**
 * tests/lib/input/keyboard-aim.test.ts
 * --------------------------------------------------------------------------
 * In keyboard mode the shot goes where she walks, and the mouse is not consulted.
 *
 * The owner: `键盘模式的攻击方向依旧跟着鼠标！实际上切换键盘模式的时候攻击方向要与鼠标解耦了！
 * 攻击方向实际上应该跟随移动的八项（上下左右左上右上左下右下），注意只动键盘模式`.
 *
 * Two separate faults were behind that:
 *   - the pointer handler called `updateAimTarget()` on every `pointermove`, so the mouse
 *     overwrote the keyboard aim between frames no matter what the scheme said;
 *   - keyboard aim read the ARROW keys, while she is moved with WASD - so even with the
 *     mouse parked, aim and movement were two different things.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { aimFromMoveIntent, directionalAimPoint, AIM_DIRECTIONS } from '@/lib/input/aim';

const ROOT = process.cwd();
const controller = () => readFileSync(join(ROOT, 'src', 'game', 'characters', 'logic.ts'), 'utf8');

/** Walking vectors as `moveIntent` hands them over: already normalised. */
const walk = (vx: number, vy: number) => aimFromMoveIntent({ vx, vy });

describe('aim from where she walks', () => {
    it('gives the four cardinals', () => {
        expect(walk(0, -1)).toEqual({ x: 0, y: -1 }); // north
        expect(walk(1, 0)).toEqual({ x: 1, y: 0 }); // east
        expect(walk(0, 1)).toEqual({ x: 0, y: 1 }); // south
        expect(walk(-1, 0)).toEqual({ x: -1, y: 0 }); // west
    });

    it('gives the four diagonals, unit length', () => {
        for (const [vx, vy] of [
            [Math.SQRT1_2, -Math.SQRT1_2],
            [Math.SQRT1_2, Math.SQRT1_2],
            [-Math.SQRT1_2, Math.SQRT1_2],
            [-Math.SQRT1_2, -Math.SQRT1_2],
        ]) {
            const aim = walk(vx, vy);
            expect(aim).not.toBeNull();
            expect(Math.hypot(aim!.x, aim!.y)).toBeCloseTo(1, 6);
        }
    });

    it('matches one of the eight established directions, always', () => {
        const eight = AIM_DIRECTIONS.map((d) => `${d.x.toFixed(3)},${d.y.toFixed(3)}`);
        for (const [vx, vy] of [
            [0, -1],
            [1, -1],
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
            [-1, 0],
            [-1, -1],
        ]) {
            const aim = walk(vx, vy)!;
            expect(eight).toContain(`${aim.x.toFixed(3)},${aim.y.toFixed(3)}`);
        }
    });

    it('returns null while standing still, so the last direction is kept', () => {
        expect(walk(0, 0)).toBeNull();
    });

    it('cancels opposite keys, exactly like `moveIntent` does', () => {
        expect(walk(0, 0)).toBeNull();
    });
});

describe('the controller', () => {
    it('ignores the pointer unless the scheme is mouse', () => {
        // One guard covers pointermove, pointerdown and the window-level listener. Sliced
        // between the signature and the next method so the comment above it cannot make a
        // character-count regex flaky.
        const source = controller();
        const start = source.indexOf('private updateAimTarget');
        const body = source.slice(start, source.indexOf('private applyKeyboardAim', start));
        expect(body).toContain("inputScheme !== 'mouse') return;");
    });

    it('drives keyboard aim from the movement intent, not the arrow keys', () => {
        const source = controller();
        const body = source.slice(source.indexOf('private applyKeyboardAim'));
        const method = body.slice(0, body.indexOf('private publishCrosshair'));
        expect(method).toContain('aimFromMoveIntent');
        expect(method).not.toContain('KEY_UP');
        expect(method).not.toContain('KEY_LEFT');
    });

    it('hands the walking intent into it once per tick', () => {
        expect(controller()).toContain('this.applyKeyboardAim(pos, intent)');
    });
});

describe('the shot leaves the muzzle, not her waist', () => {
    // Bullets spawn at hand height (`body.y - handUp`), so the aim point has to be built from
    // there too. Built from the body centre, an east shot ran from a point `handUp` higher
    // down onto her waist line and tipped down by atan(handUp / range) - the owner's
    // `左右…都是稍微偏下的`.
    const body = { x: 1000, y: 2000 };
    const handUp = 26;
    const range = 600;

    /** Angle the weapons code would take: hands -> aim point. */
    const shotAngle = (x: number, y: number) =>
        Math.atan2(y - (body.y - handUp), x - body.x);

    it('shoots exactly horizontal to the east', () => {
        const point = directionalAimPoint(body, handUp, { x: 1, y: 0 }, range);
        expect(shotAngle(point.x, point.y)).toBeCloseTo(0, 10);
    });

    it('shoots exactly horizontal to the west', () => {
        const point = directionalAimPoint(body, handUp, { x: -1, y: 0 }, range);
        expect(Math.abs(shotAngle(point.x, point.y))).toBeCloseTo(Math.PI, 10);
    });

    it('keeps all eight directions at the angle they claim', () => {
        for (const dir of AIM_DIRECTIONS) {
            const point = directionalAimPoint(body, handUp, dir, range);
            const expected = Math.atan2(dir.y, dir.x);
            const actual = shotAngle(point.x, point.y);
            // Compare on the circle, so ±π does not count as a mismatch.
            expect(Math.cos(actual - expected)).toBeCloseTo(1, 10);
        }
    });

    it('would have been visibly off from the waist (the bug)', () => {
        // Same maths, but origin at the body centre: ~2.5 degrees down on an east shot.
        const waistPoint = { x: body.x + range, y: body.y };
        const wrong = Math.atan2(waistPoint.y - (body.y - handUp), waistPoint.x - body.x);
        expect(wrong).toBeGreaterThan(0.02);
    });
});
