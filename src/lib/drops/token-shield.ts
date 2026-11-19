/**
 * src/lib/drops/token-shield.ts
 * --------------------------------------------------------------------------
 * 词元盾 (Token Shield) — the guardians' 护甲 buff, as pure numbers.
 *
 * The owner's spec, 2026-11-12:
 *
 *   `1级时将所掉血量的10%转为掉蓝量，也就是掉血90%掉蓝10%（蓝量不足时失效）`
 *   `…5级（max）时将所掉血量的50%转为掉蓝量`
 * 2026-11-15 他把上限从 5 抬到 10，并把 5 级以后改成每级 +5%（见 `TOKEN_SHIELD_SHARES`）。
 *   `独立升级路径，拣一个就是1级…拣5个就是5级（max），不进背包，拾取自动生效`
 *   `5个以上再拣时自动转化为补满血蓝`
 *
 * So the shield never reduces the *total* resource taken — it only moves a share
 * of an incoming hit from the red bar to the blue one. And it only does that
 * while the blue bar can actually pay: `蓝量不足时失效` means a hit that the SP
 * pool cannot cover in full lands entirely on HP, never half-converted.
 *
 * Kept free of Phaser and of the store on purpose — the HUD chip, the pickup and
 * the damage choke point all read the same three functions.
 */

/**
 * Levels the shield can reach by picking one up.
 *
 * 主人 2026-11-15：`将词元盾的5级上限改为10级`。
 */
export const TOKEN_SHIELD_MAX_LEVEL = 10;

/**
 * 每一级把受伤的多少转给蓝条。
 *
 * 主人 2026-11-15 的新阶梯：`前4级效果不变`（10/20/30/40%），
 * `第5级 45%，第6级 50%，第7级 55%，第8级 60%，第9级 65%，第10级（max）70%`。
 * 所以从 5 级起不是"每级 +10%"，而是每级 +5% —— 阶梯写死成表，别再乘系数。
 */
export const TOKEN_SHIELD_SHARES: readonly number[] = [
    0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
];

/**
 * 等级 = 背包里词元盾的个数（上限 5）。
 *
 * 主人 2026-11-12：`词元盾生效的等级应该跟随背包里有几个的（最大 5）`。之前等级只存在
 * `tokenShieldByCharacter` 那张表里，读档时表没恢复而背包里的盾还在，buff 就"掉了"。
 */
export function tokenShieldLevelFromCount(count: number): number {
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return 0;
    return Math.min(Math.floor(count), TOKEN_SHIELD_MAX_LEVEL);
}

export interface TokenShieldPickup {
    /** Level after the pickup, clamped at max. */
    level: number;
    /** True when this pickup was the sixth or later: it refills HP instead. */
    refilledHp: boolean;
    /** True when this pickup was the sixth or later: it refills SP instead. */
    refilledSp: boolean;
}

export interface TokenShieldSplit {
    /** Damage that actually lands on HP. */
    hp: number;
    /** Damage the SP pool pays instead. */
    sp: number;
}

/**
 * Share of an incoming hit that moves to SP at this level (0 when not held).
 *
 * Clamped on both ends: a corrupt save can neither go negative nor exceed the
 * 70% the owner set for the maxed (10th) shield.
 */
export function tokenShieldShare(level: number | undefined): number {
    if (typeof level !== 'number' || !Number.isFinite(level) || level <= 0) return 0;
    const index = Math.min(Math.floor(level), TOKEN_SHIELD_MAX_LEVEL) - 1;
    return TOKEN_SHIELD_SHARES[index] ?? 0;
}

/**
 * Split one incoming hit between HP and SP.
 *
 * `spRemaining` is what the blue pool still has. When it cannot cover the whole
 * converted share the shield simply does not fire — the full hit goes to HP,
 * exactly as the owner asked (`蓝量不足时失效`), rather than converting a part
 * of it and leaving the player believing the shield did something.
 */
export function splitTokenShieldDamage(
    rawDamage: number,
    level: number | undefined,
    spRemaining: number,
): TokenShieldSplit {
    const damage = Math.max(0, Math.round(rawDamage));
    const share = tokenShieldShare(level);
    if (damage === 0 || share === 0) return { hp: damage, sp: 0 };

    const wanted = Math.max(1, Math.round(damage * share));
    if (!Number.isFinite(spRemaining) || spRemaining < wanted) return { hp: damage, sp: 0 };

    return { hp: damage - wanted, sp: wanted };
}

/** The whole ladder, for the HUD tooltip: one row per level. */
export function tokenShieldLevels(): { level: number; percent: number }[] {
    const rows: { level: number; percent: number }[] = [];
    for (let level = 1; level <= TOKEN_SHIELD_MAX_LEVEL; level += 1) {
        rows.push({ level, percent: Math.round(tokenShieldShare(level) * 100) });
    }
    return rows;
}

/**
 * Apply one pickup to the current level.
 *
 * The ladder is independent of every other upgrade: the shield is not bought and
 * not spent, so picking the same item ten times *is* the upgrade path. The eleventh
 * pickup has nowhere left to go, and the owner's rule is that it refills both
 * bars instead (`5个以上再拣时自动转化为补满血蓝`，上限升到 10 以后就是 11 个以上).
 */
export function collectTokenShield(currentLevel: number | undefined): TokenShieldPickup {
    const level =
        typeof currentLevel === 'number' && Number.isFinite(currentLevel)
            ? Math.max(0, Math.floor(currentLevel))
            : 0;

    if (level >= TOKEN_SHIELD_MAX_LEVEL) {
        return { level: TOKEN_SHIELD_MAX_LEVEL, refilledHp: true, refilledSp: true };
    }
    return { level: level + 1, refilledHp: false, refilledSp: false };
}