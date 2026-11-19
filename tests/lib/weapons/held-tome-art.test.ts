/**
 * tests/lib/weapons/held-tome-art.test.ts
 * --------------------------------------------------------------------------
 * 教典 is a real book in her hand, not a rune slab.
 *
 * The owner: `将Claude的近战武器立绘换成这个` over a photo of a leather tome. The weapon
 * pointed at `rune-shield.png` - a placeholder with a comment admitting it - and that same
 * shield art was doing duty on two other weapons, so a player could not tell the scholar's
 * book from the cat's charm at a glance.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const WEAPON_ID = 'scripture';
const spec = parseWeaponYaml(
    readFileSync(join(ROOT, 'public', 'data', 'weapons', `${WEAPON_ID}.yaml`), 'utf8'),
    WEAPON_ID,
);

function pngSize(path: string): { width: number; height: number } {
    const buf = readFileSync(path);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('the scripture tome', () => {
    it('is still her melee weapon', () => {
        expect(spec.hitWidth).toBeGreaterThan(0);
        expect(spec.nameZh).toBe('教典');
    });

    it('points at its own art, not the shared rune slab', () => {
        expect(spec.visual?.texture).toBe('assets/image/weapons/scripture-tome.png');
        expect(spec.visual?.texture).not.toContain('rune-shield');
    });

    it('ships that art, laid on its side so the long edge follows her aim', () => {
        const path = join(ROOT, 'public', spec.visual!.texture!);
        expect(existsSync(path)).toBe(true);
        const { width, height } = pngSize(path);
        // Portrait in the photo, landscape after the quarter turn.
        expect(width).toBeGreaterThan(height);
        expect(width).toBeGreaterThan(300);
    });

    it('is sized like the other things she holds', () => {
        const { width } = pngSize(join(ROOT, 'public', spec.visual!.texture!));
        const onScreen = width * (spec.visual?.scale ?? 1);
        expect(onScreen).toBeGreaterThan(110);
        expect(onScreen).toBeLessThan(170);
    });

    it('grips the near end of the spine', () => {
        expect(spec.visual?.anchor?.[0]).toBeLessThan(0.2);
    });

    it('keeps the shut-book arc it swings', () => {
        expect(spec.bullet?.texture).toContain('plasma-slash-arc');
    });

    it('does not share art with another held weapon any more', () => {
        const dir = join(ROOT, 'public', 'data', 'weapons');
        const users = readdirSync(dir)
            .sort()
            .filter((file) => file.endsWith('.yaml') && file !== 'index.yaml')
            .filter((file) =>
                readFileSync(join(dir, file), 'utf8').includes('scripture-tome.png'),
            );
        expect(users).toEqual(['scripture.yaml']);
    });
});