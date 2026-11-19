/**
 * tests/lib/characters/hp-ladder.test.ts
 * --------------------------------------------------------------------------
 * 【血量】: a fifth shop ladder, between 敏捷 and 精神.
 *
 * The owner: `在商店里敏捷下方精神上方再加一个【血量】，同样是满级5级，每级+20最大血量上限`.
 *
 * Two things this file pins down, because both are easy to get subtly wrong:
 *   - the ORDER, which is just the YAML key order the shop iterates, and
 *   - the SIZE of the bonus, which is `stat: hp, mode: add, perLevel: 20` - the same
 *     mechanism 精神 already uses for its +10 HP, so max HP grows without any new engine code.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { applyUpgrades, maxUpgradeLevel, upgradeCost } from '@/lib/characters/upgrades';
import { parseCharacterYaml } from '@/lib/characters/parser';
import en from '@/locales/en';
import zhCN from '@/locales/zh-CN';

const CHARACTERS = readdirSync(join(process.cwd(), 'public', 'data', 'characters'))
    .filter((file) => file.endsWith('.yaml') && file !== 'index.yaml')
    .map((file) => file.replace(/\.yaml$/, ''));

const specOf = (id: string) =>
    parseCharacterYaml(
        readFileSync(join(process.cwd(), 'public', 'data', 'characters', `${id}.yaml`), 'utf8'),
        id,
    );

describe('the 血量 ladder', () => {
    for (const id of CHARACTERS) {
        it(`${id} has it, five levels deep`, () => {
            const spec = specOf(id);
            expect(spec.upgrades?.hp).toBeDefined();
            expect(maxUpgradeLevel(spec, 'hp')).toBe(5);
            expect(upgradeCost(spec, 'hp', 0)).toBeGreaterThan(0);
            expect(upgradeCost(spec, 'hp', 4)).toBeGreaterThan(0);
            expect(upgradeCost(spec, 'hp', 5)).toBeNull();
        });
    }

    it('adds 20 max HP per level', () => {
        const spec = specOf('deepseek');
        const base = spec.hp;
        expect(applyUpgrades(spec, { hp: 1 }).hp).toBe(base + 20);
        expect(applyUpgrades(spec, { hp: 5 }).hp).toBe(base + 100);
    });

    it('sits between 敏捷 and 精神, which is the shop row order', () => {
        // `Object.entries(spec.upgrades)` is what the shop renders, so the YAML key order IS
        // the UI order: 护甲 / 敏捷 / 血量 / 精神 / 幸运.
        const spec = specOf('deepseek');
        const order = Object.keys(spec.upgrades ?? {});
        expect(order.indexOf('agility')).toBeLessThan(order.indexOf('hp'));
        expect(order.indexOf('hp')).toBeLessThan(order.indexOf('spirit'));
    });

    it('is named in both catalogs', () => {
        expect(zhCN.shop.upgrade.hp).toBe('血量');
        expect(en.shop.upgrade.hp.length).toBeGreaterThan(0);
    });
});