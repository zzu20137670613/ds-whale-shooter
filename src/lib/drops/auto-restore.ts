/**
 * src/lib/drops/auto-restore.ts
 * --------------------------------------------------------------------------
 * 自动补给：血/蓝见底时，背包里的碎片自己下去。
 *
 * 主人 2026-11-13：
 * `改为血量掉落至<=30%时，自动使用生命碎片回复至>=60%，蓝量同理掉落至<=30%时，自动回复至
 *  >=60%（都是背包有血药蓝药的情况下），此机制给PC端也加上吧`。
 *
 * 触发线与目标线是两个数，这是整条规则的关键：一片生命碎片只值 25 点，30% 触发后第一片
 * 只把血抬到 40% 上下 —— 如果判定仍是“低于 30% 才喝”，它就在 40% 停住，永远到不了 60%。
 * 所以这里用迟滞（hysteresis）：≤30% 上膛，≥60% 才退膛，中间地带保持上一次的状态。
 *
 * 两件事足以让它把道具喝成浪费，这里都挡住了：
 *   - 喝到目标线就停（不会在满血上再喝一瓶）；
 *   - 背包里没有对应碎片就什么都不做（不会把别的药当血药用）。
 *
 * 2026-11-13 之前这套逻辑只在手机端（`lib/mobile/auto-heal.ts`），且只补血。主人要求两端
 * 一致、血蓝都管，于是搬到这里，模块也不再是“手机专属”。
 */

/** 低于（含）这个百分比时开喝。 */
export const AUTO_RESTORE_TRIGGER_PCT = 30;

/** 喝到这个百分比（含）为止。 */
export const AUTO_RESTORE_TARGET_PCT = 60;

/**
 * 两次自动补给之间的间隔，ms。
 *
 * 慢到一片碎片 +25 已经落账（否则一次 25 点的缺口会被灌进两片），快到被啃的时候不会看着
 * 血条停在 35% 不动。
 */
export const AUTO_RESTORE_INTERVAL_MS = 350;

/** 两条池子各自一套。 */
export type RestoreKind = 'hp' | 'sp';

/**
 * 每种补给用哪个道具。
 *
 * 只认这两种：主人说的是「生命碎片」和蓝药（灵力碎片）。过载核心、海底特饮之类一次补两样
 * 的东西不在自动补给的名单里 —— 它们更贵，留给玩家自己决定什么时候喝。
 */
export const AUTO_RESTORE_ITEMS: Readonly<Record<RestoreKind, string>> = {
    hp: 'hp-shard',
    sp: 'sp-fragment',
};

/** 这一池现在是第几成（0..1）。非法数值一律当成“健康”，不动背包。 */
export function restoreShare(current: number, max: number): number {
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 1;
    return Math.max(0, Math.min(1, current / max));
}

/** 掉到触发线了？（含等于） */
export function isBelowRestoreTrigger(current: number, max: number): boolean {
    return restoreShare(current, max) * 100 <= AUTO_RESTORE_TRIGGER_PCT;
}

/** 已经到目标线了？（含等于） */
export function reachedRestoreTarget(current: number, max: number): boolean {
    return restoreShare(current, max) * 100 >= AUTO_RESTORE_TARGET_PCT;
}

/**
 * 这一帧的“该不该喝”状态（迟滞）。
 *
 * - 死了（current <= 0）就不喝：碎片是玩家的，不该替他决定。
 * - 到目标线 → 退膛。
 * - 掉到触发线 → 上膛。
 * - 两者之间 → 保持上一次的状态（这就是它能从 40% 一路补到 60% 的原因）。
 */
export function nextRestoreArmed(armed: boolean, current: number, max: number): boolean {
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return false;
    if (current <= 0) return false;
    if (reachedRestoreTarget(current, max)) return false;
    if (isBelowRestoreTrigger(current, max)) return true;
    return armed;
}

/**
 * 该从背包哪一格喝，或 -1。
 *
 * 第一个匹配就够：背包是定位的，同类碎片彼此等价。
 */
export function restoreSlotIndex(
    inventory: readonly { dropId: string }[],
    kind: RestoreKind,
): number {
    const wanted = AUTO_RESTORE_ITEMS[kind];
    return inventory.findIndex((slot) => slot.dropId === wanted);
}
