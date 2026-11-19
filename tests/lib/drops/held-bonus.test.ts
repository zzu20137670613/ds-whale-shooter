/**
 * tests/lib/drops/held-bonus.test.ts
 * --------------------------------------------------------------------------
 * 加冕之冠：带在背包里 +100 血上限、+100 蓝上限；拿走就失效。
 *
 * 主人 2026-11-17 在两个选项里选的是「放背包里就一直生效，拿走就失效」，
 * 所以这一层的核心断言只有一条：**加成是背包内容的函数**，不是身上的一次性属性。
 */

import { describe, expect, it } from 'vitest';

import {
    heldMaxBonus,
    maxBonusOf,
    registerMaxBonus,
    registeredMaxBonus,
    withMaxBonus,
} from '@/lib/drops/held-bonus';
import type { DropSpec } from '@/lib/drops/types';

const crown = {
    name: 'Coronation Crown',
    nameZh: '加冕之冠',
    sellPrice: 0,
    kind: 'static',
    visual: { size: 26, tint: 0xfbbf24 },
    effect: { type: 'max-bonus', hp: 100, sp: 100 },
} as unknown as DropSpec;

const shard = {
    name: 'HP Shard',
    nameZh: '生命碎片',
    sellPrice: 1,
    kind: 'static',
    visual: { size: 20, tint: 0xef4444 },
    effect: { type: 'instant', hp: 25 },
} as unknown as DropSpec;

const specs = new Map<string, DropSpec>([
    ['crown', crown],
    ['hp-shard', shard],
]);
const specOf = (id: string) => specs.get(id);

describe('maxBonusOf', () => {
    it('reads the crown', () => {
        expect(maxBonusOf(crown)).toEqual({ hp: 100, sp: 100 });
    });

    it('is zero for anything else', () => {
        expect(maxBonusOf(shard)).toEqual({ hp: 0, sp: 0 });
        expect(maxBonusOf(undefined)).toEqual({ hp: 0, sp: 0 });
    });
});

describe('heldMaxBonus', () => {
    it('adds nothing when the bag is empty', () => {
        expect(heldMaxBonus([], specOf)).toEqual({ hp: 0, sp: 0 });
    });

    it('counts the crown while it is in the bag', () => {
        expect(heldMaxBonus([{ dropId: 'crown', count: 1 }], specOf)).toEqual({ hp: 100, sp: 100 });
    });

    it('drops the bonus the moment the crown is gone', () => {
        // 「拿走就失效」—— 这条是主人选的方案，不是消耗品。
        const withCrown = heldMaxBonus([{ dropId: 'crown', count: 1 }], specOf);
        const without = heldMaxBonus([{ dropId: 'hp-shard', count: 3 }], specOf);
        expect(withCrown.hp).toBe(100);
        expect(without).toEqual({ hp: 0, sp: 0 });
    });

    it('still finds the crown in a level whose drop table does not list it', () => {
        // 2026-11-17 实机：回海边亭台之后 +100 消失 —— 因为那关的掉落表里没有加冕之冠。
        registerMaxBonus('crown', crown);
        expect(registeredMaxBonus('crown')).toEqual({ hp: 100, sp: 100 });
        const noSpecs = () => undefined;
        expect(heldMaxBonus([{ dropId: 'crown', count: 1 }], noSpecs)).toEqual({
            hp: 100,
            sp: 100,
        });
    });

    it('counts a duplicate hold as one, not as a stack', () => {
        // 存档里刷出来的 ×3 不能变成 +300。
        expect(heldMaxBonus([{ dropId: 'crown', count: 3 }], specOf)).toEqual({ hp: 100, sp: 100 });
    });

    it('ignores drops it cannot resolve', () => {
        // 背包里有个不认识的 id（旧存档、删掉的道具）不许把总账变成 NaN。
        expect(heldMaxBonus([{ dropId: 'mystery', count: 2 }], specOf)).toEqual({ hp: 0, sp: 0 });
    });
});

describe('withMaxBonus', () => {
    it('raises both caps on a copy', () => {
        const spec = { hp: 110, sp: 190 };
        const next = withMaxBonus(spec, { hp: 100, sp: 100 });
        expect(next).toEqual({ hp: 210, sp: 290 });
        // 原对象不动：spec 是全局共享的角色数据。
        expect(spec).toEqual({ hp: 110, sp: 190 });
    });

    it('returns the same object when there is nothing to add', () => {
        const spec = { hp: 110, sp: 190 };
        expect(withMaxBonus(spec, { hp: 0, sp: 0 })).toBe(spec);
    });
});