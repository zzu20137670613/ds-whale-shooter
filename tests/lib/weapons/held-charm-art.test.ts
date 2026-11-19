/**
 * tests/lib/weapons/held-charm-art.test.ts
 * --------------------------------------------------------------------------
 * 灭妖符 is a piece of paper in her hand, not a budgie shield.
 *
 * The owner: `qwen的远程武器立绘用这个` over a photo of two 黄符. The weapon spent its whole life
 * pointing at `rune-shield.png` - a placeholder borrowed from a different weapon, with a
 * comment admitting it. This keeps the real art in place: one talisman, cut out, flat enough
 * to be held, and scaled to the same length as the other held weapons.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const WEAPON_ID = 'exorcism-talisman';
const spec = parseWeaponYaml(
    readFileSync(join(ROOT, 'public', 'data', 'weapons', `${WEAPON_ID}.yaml`), 'utf8'),
    WEAPON_ID,
);

function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the exorcism talisman', () => {
    it('is still Qwen’s ranged weapon', () => {
        expect(spec.projectile).toBeDefined();
        expect(spec.nameZh).toBe('灭妖符');
    });

    it('points at its own art, not the borrowed shield', () => {
        expect(spec.visual?.texture).toBe('assets/image/weapons/exorcism-talisman.png');
        expect(spec.visual?.texture).not.toContain('rune-shield');
    });

    it('ships that art, and it is one talisman, not the pair', () => {
        const path = join(ROOT, 'public', spec.visual!.texture!);
        expect(existsSync(path)).toBe(true);
        const { width, height } = pngSize(path);
        // The source photograph was two 135x466 strips side by side. One keeps a 3:1 flat
        // sheet; the pair would have been ~2x wider still.
        expect(width / height).toBeGreaterThan(2.5);
        expect(width / height).toBeLessThan(4.5);
    });

    it('is HALF the length and TWO THIRDS the width of the first cut', () => {
        // The owner: `将qwen的灭妖符在身上显示的立绘长度缩减一半，宽度缩减1/3`.
        const { width, height } = pngSize(join(ROOT, 'public', spec.visual!.texture!));
        // 466 x 133 was the first cut; both halves are baked into the art.
        expect(width).toBeLessThanOrEqual(240);
        expect(width).toBeGreaterThanOrEqual(225);
        expect(height).toBeLessThanOrEqual(92);
        expect(height).toBeGreaterThanOrEqual(86);

        const onScreen = width * (spec.visual?.scale ?? 1);
        expect(onScreen).toBeGreaterThan(55);
        expect(onScreen).toBeLessThan(80);
    });

    it('grips at the near end, so the paper trails out front', () => {
        expect(spec.visual?.anchor?.[0]).toBeLessThanOrEqual(0.15);
    });

    it('fires a YELLOW orb, not the shared cyan one', () => {
        // `将打出去的子弹颜色改为黄色` - the orb art is tinted, so the change is visible in
        // flight rather than only in a data field.
        expect(spec.bullet?.texture).toBe('assets/image/weapons/exorcism-orb.png');
    });

    it('fires twice as often as before', () => {
        expect(spec.cooldownMs).toBe(450);
    });
});