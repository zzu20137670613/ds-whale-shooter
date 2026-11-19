/**
 * tests/lib/weapons/held-rifle-art.test.ts
 * --------------------------------------------------------------------------
 * 白龙獠牙 has its own rifle.
 *
 * The owner: `白龙獠牙的立绘改成这个`. Until now GPT's gun pointed at `assault-rifle.png` - the
 * same texture the cat's gift rifle uses - so two different characters carried visibly the
 * same weapon. The art arrives muzzle-left, so it is mirrored: every held gun in this game
 * points right, and a backwards one looks like it is firing out of the stock.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const WEAPON_ID = 'white-dragon-fangs';
const spec = parseWeaponYaml(
    readFileSync(join(ROOT, 'public', 'data', 'weapons', `${WEAPON_ID}.yaml`), 'utf8'),
    WEAPON_ID,
);

function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the white dragon fangs', () => {
    it('is still GPT’s rapid-fire rifle', () => {
        expect(spec.nameZh).toBe('白龙獠牙');
        expect(spec.clipSize).toBe(25);
        expect(spec.bulletsPerShot).toBe(2);
    });

    it('points at its own art, not the assault rifle it borrowed', () => {
        expect(spec.visual?.texture).toBe('assets/image/weapons/white-dragon-fangs.png');
        expect(spec.visual?.texture).not.toContain('assault-rifle');
    });

    it('ships that art', () => {
        const path = join(ROOT, 'public', spec.visual!.texture!);
        expect(existsSync(path)).toBe(true);
        const { width, height } = pngSize(path);
        // A rifle is long and thin, and the source was 2740px wide - 1000 keeps the texture in
        // the same weight class as every other gun in the game.
        expect(width).toBe(1000);
        expect(width / height).toBeGreaterThan(3);
    });

    it('is sized like the other held guns', () => {
        const { width } = pngSize(join(ROOT, 'public', spec.visual!.texture!));
        const onScreen = width * (spec.visual?.scale ?? 1);
        expect(onScreen).toBeGreaterThan(130);
        expect(onScreen).toBeLessThan(200);
    });

    it('grips in the middle, where the pistol grip is', () => {
        expect(spec.visual?.anchor?.[0]).toBeGreaterThan(0.2);
        expect(spec.visual?.anchor?.[0]).toBeLessThan(0.4);
    });

    it('still fires the shared bullet - the art change is the gun, not the shot', () => {
        expect(spec.bullet?.texture).toContain('assault-bullet');
    });
});