/**
 * tests/lib/levels/boss-weapon-levels.test.ts
 * --------------------------------------------------------------------------
 * 主人实测（2026-11-14）：`我已经把boss关通了，通过seed传送过来的，然后打完点开神秘商人发现枪械等级
 * 有丢的`。
 *
 * 进 boss 关会给一套满级武器（`鲸鱼娘的武器和面板要全部是满级状态的`）。原来的写法是**整张表覆盖**：
 *
 *     useGameStore.setState({ weaponLevels: maxedWeaponLevels(bossCarried, weaponsById) })
 *
 * 于是玩家自己买的那堆枪——秘法法杖、纳什之牙、白龙獠牙——在进 boss 的那一瞬间就从账本里消失了。
 * 之后只要有一次 restore 没跑（刷新页面、seed 传送、`runProgressBackup` 只在内存里而且没有
 * persist），它们就再也不回来了：商店里显示 0/5，捡到重复的还会按 `0 + 1` 结算成 1/5。
 *
 * 所以：boss 关只能**加**自己的满级项，不能抹掉别人的项。
 */

import { describe, expect, it } from 'vitest';

import { mergeBossWeaponLevels } from '@/lib/levels/boss-loadout';

describe('mergeBossWeaponLevels', () => {
    it('keeps every weapon the boss loadout does not carry', () => {
        const owned = { 'arcane-staff': 5, 'nash-tooth': 3, 'white-dragon-fangs': 3 };
        const maxed = { 'whale-cannon': 4, 'assault-rifle': 5 };

        const merged = mergeBossWeaponLevels(owned, maxed);

        expect(merged['arcane-staff']).toBe(5);
        expect(merged['nash-tooth']).toBe(3);
        expect(merged['white-dragon-fangs']).toBe(3);
        expect(merged['whale-cannon']).toBe(4);
        expect(merged['assault-rifle']).toBe(5);
    });

    it('maxes the weapons the boss level hands over, even if the save has them low', () => {
        const merged = mergeBossWeaponLevels({ 'assault-rifle': 1 }, { 'assault-rifle': 5 });
        expect(merged['assault-rifle']).toBe(5);
    });

    it('does not mutate either input', () => {
        const owned = { a: 1 };
        const maxed = { b: 5 };
        mergeBossWeaponLevels(owned, maxed);
        expect(owned).toEqual({ a: 1 });
        expect(maxed).toEqual({ b: 5 });
    });

    it('returns the maxed map when there is nothing owned yet', () => {
        expect(mergeBossWeaponLevels({}, { rifle: 5 })).toEqual({ rifle: 5 });
    });
});
