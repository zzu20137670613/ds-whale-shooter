/**
 * tests/lib/weapons/fan-card.test.ts
 * --------------------------------------------------------------------------
 * The crane fan stands up on its card, and sits smaller in her hands.
 *
 * The owner: `鹤扇在武器卡上的立绘被裁了两个边…将横向立绘旋转90度在武器卡上显示，改为竖向，并且
 * 立绘在人物上打怪时显得太大了，整体缩减1/3（数值什么的都不改，只改立绘显示）`.
 *
 * Why it cropped: the card lays every weapon down at -90°, which is right for a rifle (long
 * and thin) but wrong for a fan (taller than it is wide) - rotated, its height became the
 * card's width and `overflow-hidden` ate both edges. `visual.cardRotation: 0` opts out.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const spec = parseWeaponYaml(
    readFileSync(join(ROOT, 'public', 'data', 'weapons', 'crane-fan.yaml'), 'utf8'),
    'crane-fan',
);

describe('the card layout', () => {
    it('keeps the fan upright', () => {
        expect(spec.visual?.cardRotation).toBe(0);
    });

    it('leaves every other weapon lying down', () => {
        // The default is the house layout; only tall art opts out.
        const rifle = parseWeaponYaml(
            readFileSync(join(ROOT, 'public', 'data', 'weapons', 'assault-rifle.yaml'), 'utf8'),
            'assault-rifle',
        );
        expect(rifle.visual?.cardRotation).toBe(-90);
    });
});

describe('the fan in her hands', () => {
    it('is a third smaller than it was', () => {
        // 0.321 -> 0.214 is -33%.
        expect(spec.visual?.scale).toBeCloseTo(0.214, 3);
        expect(spec.visual!.scale! / 0.321).toBeLessThan(0.7);
    });

    it('is now about the size of the other weapons she holds', () => {
        // The art is 405px wide; at 0.214 that is ~87px of fan, against a blade's ~118-130.
        expect(405 * spec.visual!.scale!).toBeGreaterThan(75);
        expect(405 * spec.visual!.scale!).toBeLessThan(100);
    });
});

describe('what was NOT changed', () => {
    it('keeps every number: damage, cooldown, range, hit box, ladder', () => {
        expect(spec.damage).toBe(40);
        expect(spec.cooldownMs).toBe(420);
        expect(spec.range).toBe(180);
        expect(spec.hitWidth).toBe(140);
        expect(spec.hitHeight).toBe(120);
        expect(spec.upgrades?.costs).toEqual([36, 80, 140, 220, 320]);
    });

    it('keeps the rivet as the pivot', () => {
        expect(spec.visual?.anchor?.[0]).toBeLessThan(0.1);
    });
});