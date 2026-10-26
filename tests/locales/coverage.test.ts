/**
 * tests/locales/coverage.test.ts
 * --------------------------------------------------------------------------
 * Every `t('...')` key the UI asks for must exist in both catalogs.
 *
 * `t()` is typed to also accept a bare string, and it falls back to returning
 * the key itself, so a missing entry is not a crash or a type error - it is the
 * literal text `tavern.select` rendered on a button. That is exactly the kind of
 * bug a screenshot review catches and CI does not, so this file is the CI part.
 *
 * Two call shapes exist here and both count:
 *   t('shop.title')            - a literal key
 *   t(`shop.upgrade.${id}`)    - a whole namespace, built from a spec id
 * Missing the second shape would report the four upgrade rows as dead strings
 * and invite someone to delete text that is very much on screen.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { flatten } from '@/locales';
import en from '@/locales/en';
import zhCN from '@/locales/zh-CN';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

interface Usage {
    /** Literal keys, mapped to the files that ask for them. */
    keys: Map<string, string[]>;
    /** Namespace prefixes used through a template literal, e.g. `shop.upgrade.`. */
    namespaces: Map<string, string[]>;
}

function collectUsage(): Usage {
    const keys = new Map<string, string[]>();
    const namespaces = new Map<string, string[]>();
    const add = (map: Map<string, string[]>, key: string, where: string) =>
        map.set(key, [...(map.get(key) ?? []), where]);

    for (const file of walk(SRC)) {
        if (file.includes(`locales${'/'}`)) continue; // the catalogs themselves
        const text = readFileSync(file, 'utf8');
        const where = file.slice(SRC.length + 1);
        for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) add(keys, m[1], where);
        for (const m of text.matchAll(/\bt\(\s*`([a-zA-Z][\w.]*)\.\$\{/g)) {
            add(namespaces, `${m[1]}.`, where);
        }
    }
    return { keys, namespaces };
}

const enFlat = flatten(en);
const zhFlat = flatten(zhCN);

/** The editor panel is not the game's UI; it goes when the editor goes. */
const NOT_GAME_UI = (key: string): boolean => key.startsWith('menu.') || key.startsWith('label.');

describe('locale catalogs', () => {
    it('has the same keys in both languages', () => {
        expect(Object.keys(zhFlat).sort()).toEqual(Object.keys(enFlat).sort());
    });

    it('has no empty strings', () => {
        for (const [key, value] of Object.entries(enFlat)) {
            expect(value.trim(), `en.${key}`).not.toBe('');
        }
        for (const [key, value] of Object.entries(zhFlat)) {
            expect(value.trim(), `zh-CN.${key}`).not.toBe('');
        }
    });

    it('defines every key the UI asks for, in both languages', () => {
        const { keys } = collectUsage();
        const missingEn: string[] = [];
        const missingZh: string[] = [];
        for (const [key, where] of keys) {
            const trail = ` (used in ${[...new Set(where)].join(', ')})`;
            if (!(key in enFlat)) missingEn.push(key + trail);
            if (!(key in zhFlat)) missingZh.push(key + trail);
        }
        expect(missingEn, `missing in en.ts:\n${missingEn.join('\n')}`).toEqual([]);
        expect(missingZh, `missing in zh-CN.ts:\n${missingZh.join('\n')}`).toEqual([]);
    });

    it('does not keep keys nobody uses any more', () => {
        const { keys, namespaces } = collectUsage();
        const prefixes = [...namespaces.keys()];
        const dead = Object.keys(enFlat).filter(
            (key) =>
                !keys.has(key) && !prefixes.some((p) => key.startsWith(p)) && !NOT_GAME_UI(key),
        );
        expect(dead, `unused keys:\n${dead.join('\n')}`).toEqual([]);
    });

    it('keeps the Chinese catalog actually Chinese where it has been verified', () => {
        // Screens the owner has read on screen. If any of these regress to
        // English, the game ships a half-translated overlay again.
        expect(zhFlat['death.title']).toBe('你倒下了');
        expect(zhFlat['death.restart']).toBe('重新出发');
        expect(zhFlat['settings.resume']).toBe('继续游戏');
        expect(zhFlat['hud.hits']).toBe('连击');
        expect(zhFlat['tavern.select']).toBe('选择');
    });
});
