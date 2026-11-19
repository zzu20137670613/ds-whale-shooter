/**
 * src/lib/nickname/pool.ts
 * --------------------------------------------------------------------------
 * The nickname the player types after choosing a character.
 *
 * Two things live here, both borrowed rather than invented:
 *
 *  - the random-name pool and roll, copied from the galgame (第七世, 2026-11-01:
 *    `随机昵称 + 骰子…你直接抄`). No de-duplication, no history - it is an easter egg,
 *    not a gacha, and rolling the same name twice is allowed.
 *  - the cross-game key. The galgame hands players `deepseek1314` when they seal a run;
 *    typing it here instead of a name unlocks the hidden map (`密钥就是我们判定这个隐藏
 *    入口传送阵是否触发的密钥`).
 *
 * The key is compared after normalising case and whitespace, because 第七世 asked for
 * exactly that (`大小写和前后空格建议都做归一化`).
 */

/** 18 sea-and-blue words, straight from the galgame. */
export const RANDOM_NAME_POOL = [
    '潮生',
    '听澜',
    '归澜',
    '拾贝',
    '望海',
    '流汐',
    '沉蓝',
    '晓风',
    '无澜',
    '观海',
    '沧浪',
    '识潮',
    '逐浪',
    '问潮',
    '临渊',
    '浅潜',
    '映蓝',
    '慕鲸',
] as const;

/** The key the galgame seals with. */
export const HIDDEN_MAP_KEY = 'deepseek1314';

/** Longest nickname we accept. Long enough for any real name, short enough to fit the HUD. */
export const NICKNAME_MAX_LENGTH = 12;

/** One name from the pool. `random` is injectable so tests are deterministic. */
export function rollRandomName(random: () => number = Math.random): string {
    const index = Math.min(
        Math.floor(random() * RANDOM_NAME_POOL.length),
        RANDOM_NAME_POOL.length - 1,
    );
    return RANDOM_NAME_POOL[index]!;
}

/** Trim, collapse inner whitespace, clamp length. */
export function normaliseNickname(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ').slice(0, NICKNAME_MAX_LENGTH);
}

/**
 * Is this the cross-game key? Case- and whitespace-insensitive.
 *
 * Compared WITHOUT the length clamp: `deepseek13140` clamps down to the key, and unlocking
 * the map from a typo would be worse than making the player retype it.
 */
export function isHiddenMapKey(raw: string): boolean {
    return raw.trim().toLowerCase() === HIDDEN_MAP_KEY;
}

export type NicknameOutcome =
    | { kind: 'unlocked'; nickname: null }
    | { kind: 'accepted'; nickname: string }
    | { kind: 'rejected'; reason: 'empty' | 'key' };

/**
 * Decide what the typed text means.
 *
 * A key never becomes the player's name: it unlocks the entrance and asks for a real
 * nickname instead (`提示用户隐藏地图入口已开启，请重新输入昵称进行游玩`).
 */
export function resolveNicknameSubmission(raw: string): NicknameOutcome {
    // Order matters: the key is checked against the untruncated text.
    if (isHiddenMapKey(raw)) return { kind: 'unlocked', nickname: null };
    const name = normaliseNickname(raw);
    if (!name) return { kind: 'rejected', reason: 'empty' };
    return { kind: 'accepted', nickname: name };
}