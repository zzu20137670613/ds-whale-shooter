/**
 * src/lib/drops/codex.ts
 * --------------------------------------------------------------------------
 * 背包【图鉴】里到底列哪些东西。
 *
 * 主人 2026-11-15：`背包里面图鉴中的【武器】这一行可以去掉，不需要这行`。
 * 武器不进背包（拾取直接进快捷栏），它出现在图鉴里是噪音 —— 所以这里按 effect 类型过滤掉。
 *
 * 顺序和背包一致（`display-order`），因为图鉴就是"背包里那些东西都什么用"的说明书。
 */

import { bagRank } from './display-order';

/** 目录条目里图鉴需要的字段（`DropCatalogEntry` 是它的超集）。 */
export interface CodexSourceEntry {
    name: string;
    nameZh?: string;
    effectZh?: string;
    effectEn?: string;
    /** 掉落效果的 `type`（instant / material / weapon …）。 */
    effectKind?: string;
}

export interface CodexRow {
    id: string;
    name: string;
    nameZh?: string;
    effectZh: string;
    effectEn: string;
}

/** 图鉴不列的东西：武器。 */
export const CODEX_HIDDEN_EFFECTS: readonly string[] = ['weapon'];

/**
 * 目录 → 图鉴的行。过滤 + 排序，纯函数，方便单测。
 */
export function buildCodexRows(catalog: Record<string, CodexSourceEntry>): CodexRow[] {
    return Object.keys(catalog)
        .filter((id) => {
            const kind = catalog[id]?.effectKind;
            return !kind || !CODEX_HIDDEN_EFFECTS.includes(kind);
        })
        .map((id) => {
            const entry = catalog[id];
            return {
                id,
                name: entry.name,
                nameZh: entry.nameZh,
                effectZh: entry.effectZh ?? '',
                effectEn: entry.effectEn ?? '',
            };
        })
        .sort((a, b) => {
            const byRank = bagRank(a.id) - bagRank(b.id);
            return byRank !== 0 ? byRank : a.id.localeCompare(b.id);
        });
}