/**
 * src/lib/drops/held-bonus.ts
 * --------------------------------------------------------------------------
 * 「带在身上就生效」的上限加成 —— 目前只有一顶冠：加冕之冠（+100 血上限、+100 蓝上限）。
 *
 * 主人 2026-11-17：`放背包里可以+100血蓝上线的`，并在两个选项里选了
 * **「放背包里就一直生效，拿走就失效」**（另一个选项是"点它消耗掉、永久 +100"）。
 *
 * 为什么单独一个模块：
 *   · 它是**背包内容的函数**，不是角色身上的一次性属性 —— 每次开场景都要按当时的背包重算，
 *     所以不能在角色 YAML 里写死，也不能记进 `upgradeLevels`（那是商店的账）。
 *   · 纯函数，不碰 store，好在测试里直接算。
 *
 * 谁来加：`resolve-scene.ts` 在 `applyUpgrades` 之后把结果加到 spec 的 hp/sp 上。
 * 那之后 `spec.hp` 就是角色真正的上限，HUD、护盾、喝药全读它，不需要别处再改。
 */

import type { DropSpec } from './types';

/** 一次上限加成。 */
export interface MaxBonus {
    hp: number;
    sp: number;
}

/**
 * 见过一次就记住 —— 加成必须能在**任何关卡**算出来。
 *
 * 2026-11-17 的 bug：加成是按"当前关卡加载到的掉落表"查的。加冕之冠只在隐藏地图那张表里，
 * 于是回到海边亭台时查不到它，+100 当场消失（`回到海边亭台加成就消失了`）。
 * 掉落的 spec 本来就是全局数据，记一份在这里，跨关卡都查得到。
 */
const REGISTRY = new Map<string, MaxBonus>();

/** 记下某个掉落 id 的上限加成（`resolve-scene` 每加载一份掉落表就调一次）。 */
export function registerMaxBonus(dropId: string, spec: DropSpec | undefined): void {
    const bonus = maxBonusOf(spec);
    if (bonus.hp === 0 && bonus.sp === 0) return;
    REGISTRY.set(dropId, bonus);
}

/** 之前记下的加成；没记过返回 undefined。 */
export function registeredMaxBonus(dropId: string): MaxBonus | undefined {
    return REGISTRY.get(dropId);
}

/** 一件道具自带的上限加成；不是 `max-bonus` 类型的就是 0。 */
export function maxBonusOf(spec: DropSpec | undefined): MaxBonus {
    const effect = spec?.effect;
    if (!effect || effect.type !== 'max-bonus') return { hp: 0, sp: 0 };
    const hp = Number.isFinite(effect.hp) ? Math.max(0, effect.hp ?? 0) : 0;
    const sp = Number.isFinite(effect.sp) ? Math.max(0, effect.sp ?? 0) : 0;
    return { hp, sp };
}

/**
 * 背包里所有道具加起来的上限加成。
 *
 * 同名道具按**堆叠单位**算：背包里两顶冠就是 +200 —— 理论上限价防的是"卖商店再买回来"，
 * 而不是阻止玩家真的持有两份（今天也只有一份能拿到）。
 */
export function heldMaxBonus(
    slots: readonly { dropId: string; count: number }[],
    specOf: (dropId: string) => DropSpec | undefined,
): MaxBonus {
    let hp = 0;
    let sp = 0;
    /** 同一个 id 只算一次：这类道具是"一件"，不是"一份叠一份"。 */
    const counted = new Set<string>();
    for (const slot of slots) {
        if (counted.has(slot.dropId)) continue;
        // 当前关卡的掉落表里没有（比如回到海边亭台），就用注册过的那份。
        const one = maxBonusOf(specOf(slot.dropId)) ?? { hp: 0, sp: 0 };
        const bonus =
            one.hp === 0 && one.sp === 0 ? (registeredMaxBonus(slot.dropId) ?? { hp: 0, sp: 0 }) : one;
        if (bonus.hp === 0 && bonus.sp === 0) continue;
        counted.add(slot.dropId);
        // 只算一件：2026-11-17 的存档里有 ×3 的冠，那是刷出来的，不能再乘 3。
        hp += bonus.hp;
        sp += bonus.sp;
    }
    return { hp, sp };
}

/** 把加成加到角色 spec 上，返回新对象（不改原对象）。 */
export function withMaxBonus<T extends { hp: number; sp: number }>(spec: T, bonus: MaxBonus): T {
    if (bonus.hp === 0 && bonus.sp === 0) return spec;
    return { ...spec, hp: spec.hp + bonus.hp, sp: spec.sp + bonus.sp };
}