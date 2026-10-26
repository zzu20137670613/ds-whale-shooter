/**
 * tests/lib/characters/hand.test.ts
 * --------------------------------------------------------------------------
 * Two numbers that were wrong on screen, pinned down here instead.
 *
 *   1. The weapon orbit height. It used to be the physics box, which is knee
 *      height on a 185px-tall sprite; it is now a fraction of the drawn height.
 *   2. The headgear tint. It used to be additive, which turns light art white.
 *      The owner's words: "释放技能后变成了全白".
 */

import { describe, expect, it } from 'vitest';

import { handUpOffset, pickBodyTint } from '@/lib/characters/hand';
import { TINT_MODE_ADD, TINT_MODE_MULTIPLY } from '@/lib/constants';

describe('handUpOffset', () => {
    it('puts the hands half way up the drawn sprite, measured from her feet', () => {
        // 185.6px tall, feet 32px above the body centre (Seed's real numbers).
        expect(handUpOffset(185.6, 32)).toBeCloseTo(60.8, 1);
    });

    it('sits higher than the physics box ever did on a tall sprite', () => {
        const spriteUp = handUpOffset(185.6, 32);
        const boxUp = 28; // the old `halfH` the weapon was orbiting around
        expect(spriteUp).toBeGreaterThan(boxUp);
        // A ~33px difference is exactly "the gun is at her knees".
        expect(spriteUp - boxUp).toBeGreaterThan(30);
    });

    it('scales with the sprite, so a short character is not left aiming at the floor', () => {
        expect(handUpOffset(147.2, 26)).toBeLessThan(handUpOffset(185.6, 32));
    });

    it('honours an explicit ratio', () => {
        expect(handUpOffset(100, 0, 0.75)).toBe(75);
    });
});

describe('pickBodyTint', () => {
    const base = { hurtFlash: false, headgearWorn: false, headgearTint: 0xffe9a8, defaultTint: 0xffe9a8 };

    it('clears the tint when nothing is on', () => {
        expect(pickBodyTint(base)).toBeNull();
    });

    it('tints the headgear with MULTIPLY, never ADD - ADD is what turned her white', () => {
        const tint = pickBodyTint({ ...base, headgearWorn: true });
        expect(tint).not.toBeNull();
        expect(tint!.mode).toBe(TINT_MODE_MULTIPLY);
        expect(tint!.mode).not.toBe(TINT_MODE_ADD);
        expect(tint!.color).toBe(0xffe9a8);
    });

    it('lets the hurt flash win while it lasts', () => {
        const tint = pickBodyTint({ ...base, hurtFlash: true, headgearWorn: true });
        expect(tint!.color).toBe(0x992222);
        expect(tint!.mode).toBe(TINT_MODE_ADD);
    });

    it('uses the spec colour when the skill provides one', () => {
        expect(pickBodyTint({ ...base, headgearWorn: true, headgearTint: 0x88ccff })?.color).toBe(
            0x88ccff,
        );
    });
});
