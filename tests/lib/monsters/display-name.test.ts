/**
 * tests/lib/monsters/display-name.test.ts
 * --------------------------------------------------------------------------
 * The name above a monster's head follows the UI language.
 *
 * The owner's report: `怪物现在头顶的名字都是英文的` — the floating label used `spec.name`
 * directly instead of `pickText`, so a Chinese run showed "Barnacle Gunner" over 藤壶炮手.
 * English stays English, which is what the second test pins.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { monsterDisplayName } from '@/lib/monsters/display-name';
import { setLocale } from '@/locales';

const gunner = { name: 'Barnacle Gunner', nameZh: '藤壶炮手' };
const nameless = { name: 'Warden' };

afterEach(() => setLocale('zh-CN'));

describe('monsterDisplayName', () => {
    it('shows the Chinese name in a Chinese run', () => {
        setLocale('zh-CN');
        expect(monsterDisplayName(gunner)).toBe('藤壶炮手');
    });

    it('keeps English in an English run', () => {
        setLocale('en');
        expect(monsterDisplayName(gunner)).toBe('Barnacle Gunner');
    });

    it('falls back to the English name when a monster has no nameZh', () => {
        setLocale('zh-CN');
        expect(monsterDisplayName(nameless)).toBe('Warden');
    });
});