/**
 * src/lib/drops/easter-eggs.ts
 * --------------------------------------------------------------------------
 * Small jokes that fire on a specific drink.
 *
 * Everyone has something to say about 冰镇果汁. Only Gemini's comes with a present.
 */

/** Gemini's line - she gets the staff too. */
export const GEMINI_JUICE_LINE = '喵，果汁真好喝~~咦？这是什么喵？';

/**
 * GPT's line: Gemini's, with 喵 swapped for 嗷.
 *
 * The owner's target loadout has GPT reaching the boss with 纳什之牙 + 白龙獠牙 + 突击步枪 +
 * 秘法法杖, so she needs the same juice present Gemini gets - and her own animal noise.
 */
export const GPT_JUICE_LINE = '嗷，果汁真好喝~~咦？这是什么嗷？';

/** Everyone else's line. No present, just a drink. */
export const JUICE_LINE = '冰镇果汁，好喝！';

/** What Gemini is handed when she says hers. */
export const GEMINI_JUICE_WEAPON_ID = 'arcana-staff';

export interface DropEasterEgg {
    /** Weapon to equip (and switch to) as part of the joke. Gemini only. */
    weaponId?: string;
    /** The line above her head. */
    line: string;
}

/**
 * The juice line for this character, or null for any other drink.
 *
 * Gemini and GPT both walk away with the 秘法法杖 - it is in both of their intended boss
 * loadouts (`gpt：纳什之牙+白龙獠牙+突击步枪+秘法法杖`). Everyone else just says the line.
 */
export function juiceEasterEgg(
    characterId: string | null | undefined,
    dropId: string,
): DropEasterEgg | null {
    if (dropId !== 'iced-juice') return null;
    if (characterId === 'gemini') {
        return { weaponId: GEMINI_JUICE_WEAPON_ID, line: GEMINI_JUICE_LINE };
    }
    if (characterId === 'gpt') {
        return { weaponId: GEMINI_JUICE_WEAPON_ID, line: GPT_JUICE_LINE };
    }
    return { line: JUICE_LINE };
}