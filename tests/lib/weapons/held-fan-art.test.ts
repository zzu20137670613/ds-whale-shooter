/**
 * tests/lib/weapons/held-fan-art.test.ts
 * --------------------------------------------------------------------------
 * 鹤扇 is a folding fan in her hand, not a branch.
 *
 * The owner: `将qwen的近战武器立绘换成这个` over a photo of a blue 折扇. The weapon pointed at
 * `branch-sweep.png` - a placeholder with a comment admitting it. This keeps the real art: the
 * fan is cut out (the pale paper inside it must survive the cut-out), and the anchor sits on
 * the rivet so the leaf blooms around the point she actually holds.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const WEAPON_ID = 'crane-fan';
const spec = parseWeaponYaml(
    readFileSync(join(ROOT, 'public', 'data', 'weapons', `${WEAPON_ID}.yaml`), 'utf8'),
    WEAPON_ID,
);

function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the crane fan', () => {
    it('is still her melee weapon', () => {
        expect(spec.hitWidth).toBeGreaterThan(0);
        expect(spec.nameZh).toBe('鹤扇');
    });

    it('points at its own art, not the borrowed branch', () => {
        expect(spec.visual?.texture).toBe('assets/image/weapons/crane-fan.png');
        expect(spec.visual?.texture).not.toContain('branch-sweep');
    });

    it('ships that art', () => {
        const path = join(ROOT, 'public', spec.visual!.texture!);
        expect(existsSync(path)).toBe(true);
        const { width, height } = pngSize(path);
        // A folding fan is taller than it is wide once opened, unlike every blade in the game.
        expect(height).toBeGreaterThan(width);
        expect(width).toBeGreaterThan(300);
    });

    it('was cut by a third on the owner\'s call, so it now sits under a blade', () => {
        // `立绘在人物上打怪时显得太大了，整体缩减1/3`. 130px -> ~87px; the numbers are untouched.
        const { width } = pngSize(join(ROOT, 'public', spec.visual!.texture!));
        const onScreen = width * (spec.visual?.scale ?? 1);
        expect(onScreen).toBeGreaterThan(75);
        expect(onScreen).toBeLessThan(100);
    });

    it('pivots on the rivet at the left edge, not on the middle of the leaf', () => {
        expect(spec.visual?.anchor?.[0]).toBeLessThan(0.1);
        // The rivet is a little below the middle of the art.
        expect(spec.visual?.anchor?.[1]).toBeGreaterThan(0.45);
        expect(spec.visual?.anchor?.[1]).toBeLessThan(0.65);
    });

    it('keeps the slash arc it swings', () => {
        expect(spec.bullet?.texture).toContain('plasma-slash-arc');
    });
});