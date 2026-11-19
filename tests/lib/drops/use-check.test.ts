/**
 * tests/lib/drops/use-check.test.ts
 * --------------------------------------------------------------------------
 * The bag must not eat a consumable that would change nothing.
 *
 * Found by asking "does the ammo box bug have siblings?" — it does. Every effect type that
 * moves a number can be handed a character who is already at the cap, and the old bag code
 * consumed the item regardless.
 */

import { describe, expect, it } from 'vitest';

import { effectWouldDoSomething } from '@/lib/drops/use-check';
import type { DropEffect } from '@/lib/drops';

const hurt = { hp: 40, maxHp: 100, sp: 10, maxSp: 50 };
const full = { hp: 100, maxHp: 100, sp: 50, maxSp: 50 };

const hpShard = { type: 'instant', hp: 25 } as DropEffect; // 生命碎片
const spShard = { type: 'instant', sp: 30 } as DropEffect; // 记忆碎片
const fullRestore = { type: 'full-restore' } as DropEffect; // 海风特饮 / 冰镇果汁
const overcharge = { type: 'instant', hp: 50, sp: 50 } as DropEffect; // 过载核心
const ammoBox = { type: 'refill-ammo', ammoFraction: 0.3 } as DropEffect; // 弹药箱
const weapon = { type: 'weapon', weaponId: 'x' } as DropEffect;
const material = { type: 'material' } as DropEffect; // 藤壶

describe('healing consumables', () => {
    it('counts as useful when the bar is short', () => {
        expect(effectWouldDoSomething(hpShard, hurt)).toBe(true);
        expect(effectWouldDoSomething(spShard, hurt)).toBe(true);
        expect(effectWouldDoSomething(fullRestore, hurt)).toBe(true);
        expect(effectWouldDoSomething(overcharge, hurt)).toBe(true);
    });

    it('refuses at the cap, so the shard stays in the bag', () => {
        expect(effectWouldDoSomething(hpShard, full)).toBe(false);
        expect(effectWouldDoSomething(fullRestore, full)).toBe(false);
        expect(effectWouldDoSomething(overcharge, full)).toBe(false);
    });

    it('handles one bar full and the other not', () => {
        const hpFullSpShort = { hp: 100, maxHp: 100, sp: 10, maxSp: 50 };
        expect(effectWouldDoSomething(hpShard, hpFullSpShort)).toBe(false);
        expect(effectWouldDoSomething(spShard, hpFullSpShort)).toBe(true);
        expect(effectWouldDoSomething(fullRestore, hpFullSpShort)).toBe(true);
    });
});

describe('ammo and the things that are not consumables', () => {
    it('needs a ranged weapon to be worth consuming', () => {
        expect(effectWouldDoSomething(ammoBox, full, { hasRangedWeapon: true })).toBe(true);
        expect(effectWouldDoSomething(ammoBox, full, { hasRangedWeapon: false })).toBe(false);
    });

    it('is never true for weapons or materials', () => {
        expect(effectWouldDoSomething(weapon, hurt)).toBe(false);
        expect(effectWouldDoSomething(material, hurt)).toBe(false);
    });
});