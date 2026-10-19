/**
 * tests/locales/pick-text.test.ts
 * --------------------------------------------------------------------------
 * `pickText` is the data-side half of the bilingual mechanism: it chooses
 * between a spec's shipped string and its localized sibling.
 *
 * The mechanism is deliberately half-built (see the doc comment on
 * `pickText`) — the resolver and the locale it reads exist, the per-entity
 * `*Zh` YAML fields and the HUD call sites do not yet. These cases pin the
 * resolver's contract so wiring it up later cannot change its behaviour.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { getLocale, pickText, setLocale } from '@/locales';

afterEach(() => {
    setLocale('en');
});

describe('pickText', () => {
    it('returns the English string in the en locale even when a sibling exists', () => {
        setLocale('en');

        expect(pickText('Whale Tail Slam', '鲸娘尾击')).toBe('Whale Tail Slam');
    });

    it('prefers the localized sibling in the zh-CN locale', () => {
        setLocale('zh-CN');

        expect(pickText('Whale Tail Slam', '鲸娘尾击')).toBe('鲸娘尾击');
    });

    it('falls back to English when no sibling was supplied', () => {
        setLocale('zh-CN');

        expect(pickText('Whale Tail Slam')).toBe('Whale Tail Slam');
    });

    it('treats an empty sibling as absent rather than rendering a blank name', () => {
        setLocale('zh-CN');

        expect(pickText('Whale Tail Slam', '')).toBe('Whale Tail Slam');
    });

    it('follows the locale the store set', () => {
        setLocale('zh-CN');

        expect(getLocale()).toBe('zh-CN');
    });
});