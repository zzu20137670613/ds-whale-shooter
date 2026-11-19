/**
 * src/lib/drops/display-order.ts
 * --------------------------------------------------------------------------
 * 背包里道具的**展示顺序**（不是存储顺序）。
 *
 * 主人 2026-11-15：`进行排序，按照生命碎片-灵力碎片-弹药箱-过载核心-海底特饮-冰镇果汁-词元盾-白米饭进行排序`。
 *
 * 为什么单独一个模块：背包的槽位是位置相关的（`inventory[index]`），排序只能动**显示**，
 * 不能动底层数组 —— 否则点第 3 格用的是别的道具。所以这里只产出
 * `{ slot, index }` 的配对，点的时候仍然拿原始 index 去用。
 *
 * 名单之外的道具（以后新加的）排在最后，按掉落 id 字母序，保证顺序稳定、不随背包内容跳动。
 */

/** 主人给的固定顺序；改这一行就能改背包的排列。 */
export const BAG_DISPLAY_ORDER = [
    'hp-shard',
    'sp-fragment',
    'ammo-cache',
    'overcharge-core',
    'beach-drink',
    'iced-juice',
    'token-shield',
    // 2026-11-17 新加的 galgame 联动奖励。主人：`放在词元盾之后，白米饭之前`。
    'crown',
    'rice-bowl-basin',
] as const;

const RANK = new Map<string, number>(BAG_DISPLAY_ORDER.map((id, i) => [id, i]));

/** 名单里的排前面（按名单顺序），名单外的排后面（按 id 字母序）。 */
export function bagRank(dropId: string): number {
    return RANK.get(dropId) ?? BAG_DISPLAY_ORDER.length;
}

export interface RankedSlot<T> {
    slot: T;
    /** 在原始 `inventory` 数组里的下标 —— 点它时必须用这个。 */
    index: number;
}

/**
 * 把背包槽位按展示顺序排好。空格子直接丢掉（排序只用于画出来的格子）。
 */
export function sortBagSlots<T extends { dropId: string }>(
    slots: readonly (T | null | undefined)[],
): RankedSlot<T>[] {
    const ranked: RankedSlot<T>[] = [];
    slots.forEach((slot, index) => {
        if (slot) ranked.push({ slot, index });
    });
    ranked.sort((a, b) => {
        const byRank = bagRank(a.slot.dropId) - bagRank(b.slot.dropId);
        if (byRank !== 0) return byRank;
        const byId = a.slot.dropId.localeCompare(b.slot.dropId);
        return byId !== 0 ? byId : a.index - b.index;
    });
    return ranked;
}