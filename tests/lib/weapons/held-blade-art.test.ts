/**
 * tests/lib/weapons/held-blade-art.test.ts
 * --------------------------------------------------------------------------
 * 咸鱼剑 has its own art.
 *
 * The owner: `将鲸鲸的咸鱼剑立绘改成这个（彩蛋，这个是饥荒海难dlc里面的剑鱼短剑）`. For most of its
 * life the weapon pointed at `vine-lash.png` - a placeholder tendril borrowed from another
 * weapon, with a comment admitting it. This test is what keeps the real art in place: the file
 * exists, it is a real sprite (not a 1x1 stub), and the YAML points AT it rather than back at
 * somebody else's texture.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const WEAPON_ID = 'whale-tail-slam';
const YAML = readFileSync(join(ROOT, 'public', 'data', 'weapons', `${WEAPON_ID}.yaml`), 'utf8');
const spec = parseWeaponYaml(YAML, WEAPON_ID);

/** PNG header size, so the test does not need an image library. */
function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the salted-fish sword', () => {
    it('is still her melee blade', () => {
        expect(spec.hitWidth).toBeGreaterThan(0);
        expect(spec.nameZh).toBe('咸鱼剑');
    });

    it('points at its own texture, not the borrowed tendril', () => {
        expect(spec.visual?.texture).toBe('assets/image/weapons/salted-fish-sword.png');
        expect(spec.visual?.texture).not.toContain('vine-lash');
    });

    it('ships that texture', () => {
        const path = join(ROOT, 'public', spec.visual!.texture!);
        expect(existsSync(path)).toBe(true);
        const { width, height } = pngSize(path);
        // A blade, not a square icon: the source 64px square was trimmed after rotation.
        expect(width).toBeGreaterThan(height * 1.5);
        expect(width).toBeGreaterThanOrEqual(200);
    });

    it('is scaled to the same held length as the other blades', () => {
        // 纳什之牙: 280 x 0.42 = ~118px. Anything under ~80px reads as a dagger.
        const { width } = pngSize(join(ROOT, 'public', spec.visual!.texture!));
        const onScreen = width * (spec.visual?.scale ?? 1);
        expect(onScreen).toBeGreaterThan(100);
        expect(onScreen).toBeLessThan(150);
    });

    it('grips at the pommel end', () => {
        // The gold guard sits at the left edge after the rotation, so the anchor is left-biased.
        expect(spec.visual?.anchor?.[0]).toBeLessThan(0.25);
    });
});