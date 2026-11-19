/**
 * src/lib/characters/boss-character.ts
 * --------------------------------------------------------------------------
 * Who the player is handed on a boss map.
 *
 * The owner: `我使用gemini打boss关发现没有自动切换成deepseek，检查一下是不是判定有问题?`
 * Precedence in `resolve-scene` was `selectedCharacterId ?? level.character ?? first`, so the
 * level's `character:` field only ever spoke when the player had nothing selected. The fight is
 * designed around 鲸娘 - the maxed panel, the extra rifle, the pet bonus that only applies to
 * her - so on a boss map her name has to win.
 *
 * Deliberately a pure function: the saved pick is NOT overwritten, so the settlement's
 * `characterBeforeArena` restore still walks the player back as whoever they were.
 */

import type { Level } from '@/lib/levels';

/** The character a boss level forces, or undefined when the saved pick should stand. */
export function bossCharacterId(
    level: Pick<Level, 'boss' | 'character'>,
    selectedCharacterId: string | null | undefined,
): string | undefined {
    if (!level.boss) return undefined;
    const forced = level.character?.trim();
    if (!forced) return undefined;
    // Same answer either way; the point is that the saved pick does not get a vote here.
    return forced || selectedCharacterId || undefined;
}