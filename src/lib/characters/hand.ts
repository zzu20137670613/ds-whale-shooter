/**
 * src/lib/characters/hand.ts
 * --------------------------------------------------------------------------
 * Where a character's held weapon goes, and how her body is tinted.
 *
 * Both of these used to be spread across the visual-sync block in
 * `game/characters/logic.ts`, which is why two bugs lived there unnoticed:
 *
 *   - the weapon orbited the *physics box* (`body.y - halfH`), which on a tall
 *     sprite is knee height — Seed's gun sat at her knees;
 *   - the worn headgear tinted the sprite **additively**, and adding a warm gold
 *     to already-light art saturates every pixel to white.
 *
 * Pulling the arithmetic out here makes both answers inspectable without a
 * running scene.
 */

import { HAND_HEIGHT_RATIO, TINT_MODE_ADD, TINT_MODE_MULTIPLY } from '@/lib/constants';

/**
 * How far above the body centre the weapon's orbit should sit, in px.
 *
 * @param displayHeight  the sprite's drawn height (cell size x scale)
 * @param feetAboveCentre `halfH + spriteYOffset` — where her feet are relative
 *   to the physics body centre; the same number the sprite placement uses.
 * @param ratio  fraction of the drawn height to put the hands at
 */
export function handUpOffset(
    displayHeight: number,
    feetAboveCentre: number,
    ratio: number = HAND_HEIGHT_RATIO,
): number {
    return displayHeight * ratio - feetAboveCentre;
}

export interface TintChoice {
    color: number;
    mode: number;
}

export interface TintInput {
    /** She was just hit: the short crimson flash owns the sprite. */
    hurtFlash: boolean;
    /** The headgear is still absorbing hits. */
    headgearWorn: boolean;
    /** The headgear's own colour from the spec. */
    headgearTint: number;
    /** Fallback when a non-headgear skill is somehow "worn". */
    defaultTint: number;
}

/**
 * The tint to apply this frame, or null for "clear it".
 *
 * The headgear is always MULTIPLY: a multiply keeps the art's shading and only
 * warms it, while ADD (what shipped) pushes light sprites to pure white. The
 * hurt flash deliberately stays ADD — it is three frames long and meant to blow
 * out.
 */
export function pickBodyTint(input: TintInput): TintChoice | null {
    if (input.hurtFlash) return { color: 0x992222, mode: TINT_MODE_ADD };
    if (input.headgearWorn) return { color: input.headgearTint, mode: TINT_MODE_MULTIPLY };
    return null;
}
