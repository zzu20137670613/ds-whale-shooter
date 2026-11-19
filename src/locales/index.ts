// Minimal i18n runtime. Locale data lives as nested TS objects; this
// module flattens each catalog into dot-path keys at load time via
// `flatMap` and resolves lookups with English fallback.
// ponytail: swap for i18next when namespaces / pluralization / date
// formatting show up.

import type { Catalog, CatalogKey, LocaleCode } from './keys';
import en from './en';
import zhCN from './zh-CN';

export type { Catalog, CatalogKey, LocaleCode };

export function flatten(obj: unknown, prefix = ''): Catalog {
    if (typeof obj !== 'object' || obj === null) return {};
    const entries: Array<[string, string]> = Object.entries(obj as Record<string, unknown>).flatMap(
        ([k, v]) => {
            const key = prefix ? `${prefix}.${k}` : k;
            if (typeof v === 'string') return [[key, v] as [string, string]];
            if (typeof v === 'object' && v !== null) {
                return Object.entries(flatten(v, key));
            }
            return [];
        },
    );
    return Object.fromEntries(entries);
}

const catalogs: Record<LocaleCode, Catalog> = {
    en: flatten(en),
    'zh-CN': flatten(zhCN),
};

let current: LocaleCode = 'en';

export function setLocale(code: LocaleCode): void {
    current = code;
}

export function getLocale(): LocaleCode {
    return current;
}

export function t(key: CatalogKey, vars?: Record<string, string | number>): string;
export function t(key: string, vars?: Record<string, string | number>): string;
export function t(key: string, vars?: Record<string, string | number>): string {
    const cat = catalogs[current];
    const raw = cat[key] ?? catalogs.en[key] ?? key;
    if (!vars) return raw;
    // Minimal `{name}` interpolation. Enough for the word-order differences
    // between English and Chinese (e.g. "上限 {max} 把" vs "max {max} weapons")
    // without pulling in i18next; unknown placeholders are left untouched so
    // a typo shows up on screen instead of rendering "undefined".
    return raw.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        name in vars ? String(vars[name]) : placeholder,
    );
}

/**
 * Resolve a *data* string pair against the active locale.
 *
 * `t()` serves the UI catalog (dot-path keys). Game data is different:
 * every character / weapon / monster / drop / level carries its own
 * `name` / `title` in YAML, and inventing a catalog key per entity would
 * put the text in two places. So the data side passes the two candidates
 * directly — the shipped English string plus its optional localized
 * sibling — and this picks one.
 *
 * ── Interface status (bilingual mechanism, deliberately half-built) ──────
 * 1. DONE — the resolver, and the locale it reads (`useGameStore.locale`,
 *    persisted, calling `setLocale` so this runtime stays in step).
 * 2. DONE — UI strings: the catalog + `t()` path.
 * 3. NOT DONE — the data side has no localized siblings to pick yet: the
 *    per-entity schemas are `.strict()`, so `nameZh` in a YAML would be
 *    rejected. Adding an optional `nameZh` / `titleZh` / `descriptionZh`
 *    to the character, weapon, monster, drop and level schemas is the
 *    mechanical next step, then route the five HUD read sites through
 *    this function. Nothing else about the design changes.
 */
export function pickText(en: string, zh?: string): string {
    return current === 'zh-CN' && zh ? zh : en;
}
