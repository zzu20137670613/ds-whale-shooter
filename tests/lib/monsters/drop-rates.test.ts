/**
 * tests/lib/monsters/drop-rates.test.ts
 * --------------------------------------------------------------------------
 * 怪物数值以主人的数据总表为准（`whale-shooter_数据总表_2026-11-12_标注.xlsx`，怪物页）。
 *
 * 三次改动都记在这里：
 *   · 2026-11-16：生命碎片爆率下调（四只怪 30%）。
 *   · 2026-11-17：E 列金钱重定；并把**生命碎片和灵力碎片爆率对调** ——
 *     主人的理由：`实测发现后期灵力碎片用的多，生命碎片用的很少`。
 *
 * 这条测试的作用是把表里的数字钉进代码。以后谁再改表，先看到这里红了，就知道要同步。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseMonsterYaml } from '@/lib/monsters/parser';

const ROOT = process.cwd();
const monster = (id: string) =>
    parseMonsterYaml(readFileSync(join(ROOT, 'public', 'data', 'monsters', `${id}.yaml`), 'utf8'), id);

const dropOf = (id: string, dropId: string) =>
    monster(id).drops?.find((d) => d.dropId === dropId);

describe('money (sheet column E, 2026-11-17)', () => {
    it.each([
        ['bengbu-erba', 30],
        ['claude', 100],
        ['keeper', 30],
        ['kitty', 100],
        ['wanderer', 100],
        ['warden', 40],
    ])('%s pays %s', (id, money) => {
        expect(monster(id).money).toBe(money);
    });

    it('leaves the untouched monsters alone', () => {
        expect(monster('drone').money).toBe(14);
        expect(monster('gunner').money).toBe(12);
        expect(monster('bunny').money).toBe(100);
    });
});

describe('hp-shard vs sp-fragment (swapped 2026-11-17)', () => {
    /**
     * 对调的六只：两只碎片都掉的怪。整块 `chance/chance2/chance3` 一起换 ——
     * 三个档位是一套嵌套（掉 3 个 / 掉 2 个 / 掉 1 个），拆开换会把关系弄坏。
     */
    it.each([
        ['drone'],
        ['drone-ultra'],
        ['gunner'],
        ['keeper'],
        ['sniper'],
        ['stalker'],
    ])('%s now drops sp-fragment at least as often as hp-shard', (id) => {
        const hp = dropOf(id, 'hp-shard')!.chance;
        const sp = dropOf(id, 'sp-fragment')!.chance;
        expect(sp).toBeGreaterThanOrEqual(hp);
    });

    it('drone: hp 10% / sp 30% (was hp 30% / sp 10%)', () => {
        expect(dropOf('drone', 'hp-shard')!.chance).toBeCloseTo(0.1, 5);
        expect(dropOf('drone', 'sp-fragment')!.chance).toBeCloseTo(0.3, 5);
        expect(dropOf('drone', 'sp-fragment')!.chance2).toBeCloseTo(0.2, 5);
    });

    it('gunner: hp 20% / sp 50% (was hp 50% / sp 20%)', () => {
        expect(dropOf('gunner', 'hp-shard')!.chance).toBeCloseTo(0.2, 5);
        expect(dropOf('gunner', 'sp-fragment')!.chance).toBeCloseTo(0.5, 5);
    });

    it('the four that only dropped hp-shard now drop sp-fragment instead', () => {
        // 主人 2026-11-17：`直接更换，不掉生命碎片，掉灵力碎片` —— 概率档位照搬。
        for (const id of ['bengbu-erba', 'bunny', 'kitty', 'warden']) {
            expect(dropOf(id, 'hp-shard')).toBeUndefined();
            expect(dropOf(id, 'sp-fragment')).toBeDefined();
        }
        // 奔波儿灞与看守者原本是 hp 30%（带 20% 的多掉档），换过去原样。
        expect(dropOf('bengbu-erba', 'sp-fragment')!.chance).toBeCloseTo(0.3, 5);
        expect(dropOf('warden', 'sp-fragment')!.chance).toBeCloseTo(0.3, 5);
        expect(dropOf('warden', 'sp-fragment')!.chance2).toBeCloseTo(0.2, 5);
        // 两只守护者原来 100% 掉满，现在 100% 掉灵力。
        expect(dropOf('bunny', 'sp-fragment')!.chance).toBeCloseTo(1, 5);
        expect(dropOf('kitty', 'sp-fragment')!.chance).toBeCloseTo(1, 5);
    });

    it('keeps the multi-drop tiers intact', () => {
        const warden = monster('warden').drops ?? [];
        const ammo = warden.find((d) => d.dropId === 'ammo-cache');
        expect(ammo?.chance2).toBeGreaterThan(0);
    });
});