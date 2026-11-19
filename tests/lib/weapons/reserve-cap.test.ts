/**
 * tests/lib/weapons/reserve-cap.test.ts
 * --------------------------------------------------------------------------
 * An upgraded magazine capacity must survive a scene change.
 *
 * The owner's report: a gun carrying 35/140 came back from 开发者小屋 → 海边亭台 as 35/70, and
 * 海滩假日 showed the same. The level lives in `weaponLevels`, but the weapon controller asked
 * `reserveMaxFor(clipSize)` — the LEVEL-0 capacity — in five places. The constructor clamped the
 * saved reserve against that cap, so the extra capacity was thrown away on every load, and the
 * shop's refill, a pickup and the HUD's max all agreed on the wrong number.
 */

import { describe, expect, it } from 'vitest';

import { reserveCapFor, reserveMaxFor } from '@/lib/weapons/ammo';

/** The gun in the report: 35 round magazine, so 2 clips = 70 and 4 clips = 140. */
const rifle = { clipSize: 35, bullet: { type: 'projectile' } };
const sword = { hitWidth: 60 };

describe('reserve capacity follows the upgrade level', () => {
    it('reproduces the numbers from the bug report', () => {
        expect(reserveMaxFor(35, 0)).toBe(70);
        expect(reserveMaxFor(35, 2)).toBe(140);
        expect(reserveCapFor(rifle, 0)).toBe(70);
        expect(reserveCapFor(rifle, 2)).toBe(140);
    });

    it('keeps growing with every level', () => {
        const caps = [0, 1, 2, 3, 4, 5].map((lv) => reserveCapFor(rifle, lv));
        expect(caps).toEqual([70, 105, 140, 175, 210, 245]);
    });

    it('still gives melee weapons no reserve at all', () => {
        expect(reserveCapFor(sword, 5)).toBe(0);
        expect(reserveCapFor({ bullet: { type: 'melee' }, clipSize: 5 }, 3)).toBe(0);
    });

    it('treats a weapon with no clipSize as a one-round magazine', () => {
        // clip 1 × (2 + level) clips: 4 at level 2. My first guess here was 8 and the
        // formula said 4 - the assertion follows the engine, not the other way round.
        expect(reserveCapFor({ bullet: { type: 'projectile' } }, 2)).toBe(4);
    });
});