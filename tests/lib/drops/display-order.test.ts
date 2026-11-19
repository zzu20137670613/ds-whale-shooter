/**
 * tests/lib/drops/display-order.test.ts
 * --------------------------------------------------------------------------
 * 背包的展示顺序是主人 2026-11-15 定死的：
 * 生命碎片 - 灵力碎片 - 弹药箱 - 过载核心 - 海底特饮 - 冰镇果汁 - 词元盾 - 白米饭。
 *
 * 关键一点：排序只影响**画在哪一格**，不能动底层数组下标 —— 点第 3 格必须用第 3 个槽位。
 */

import { describe, expect, it } from 'vitest';

import { BAG_DISPLAY_ORDER, bagRank, sortBagSlots } from '@/lib/drops/display-order';

const slot = (dropId: string, count = 1) => ({ dropId, count });

describe('bagRank', () => {
    it('follows the owner order exactly', () => {
        const expected = [
            'hp-shard',
            'sp-fragment',
            'ammo-cache',
            'overcharge-core',
            'beach-drink',
            'iced-juice',
            'token-shield',
            // 2026-11-17：galgame 联动奖励加冕之冠，主人指定排在词元盾之后、白米饭之前。
            'crown',
            'rice-bowl-basin',
        ];
        expect([...BAG_DISPLAY_ORDER]).toEqual(expected);
        for (let i = 1; i < expected.length; i++) {
            expect(bagRank(expected[i]), expected[i]).toBeGreaterThan(bagRank(expected[i - 1]));
        }
    });

    it('puts unknown drops after every listed one', () => {
        expect(bagRank('some-future-drop')).toBe(BAG_DISPLAY_ORDER.length);
    });
});

describe('sortBagSlots', () => {
    it('sorts a scrambled bag into the owner order', () => {
        const bag = [
            slot('rice-bowl-basin'),
            null,
            slot('token-shield'),
            slot('hp-shard', 30),
            slot('beach-drink'),
        ];
        const order = sortBagSlots(bag).map((r) => r.slot.dropId);
        expect(order).toEqual(['hp-shard', 'beach-drink', 'token-shield', 'rice-bowl-basin']);
    });

    it('keeps the original array index so using the item still hits the right slot', () => {
        const bag = [slot('rice-bowl-basin'), null, slot('hp-shard')];
        const ranked = sortBagSlots(bag);
        // 生命碎片原来在 2 号槽，排到第一个格子之后 index 仍然是 2。
        expect(ranked[0]).toMatchObject({ index: 2, slot: { dropId: 'hp-shard' } });
        expect(ranked[1]).toMatchObject({ index: 0, slot: { dropId: 'rice-bowl-basin' } });
    });

    it('drops empty cells instead of sorting holes to the front', () => {
        expect(sortBagSlots([null, undefined, slot('hp-shard')])).toHaveLength(1);
    });

    it('is stable for two drops outside the list', () => {
        const order = sortBagSlots([slot('zeta-drop'), slot('alpha-drop')]).map((r) => r.slot.dropId);
        expect(order).toEqual(['alpha-drop', 'zeta-drop']);
    });
});