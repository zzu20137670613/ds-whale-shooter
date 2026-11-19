/**
 * tests/locales/interpolate.test.ts
 * --------------------------------------------------------------------------
 * `t()` grew a minimal `{name}` interpolation so the tavern card can express
 * word-order differences between English and Chinese ("上限 {max} 把" vs
 * "max {max} weapons") without a prefix/suffix key pair per string.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale, t } from '@/locales';

describe('locales/t — {name} interpolation', () => {
    afterEach(() => {
        setLocale('en');
    });

    it('leaves a string without placeholders untouched', () => {
        expect(t('tavern.cycle')).toBe('Cycle');
    });

    it('fills several placeholders in one string', () => {
        setLocale('zh-CN');

        expect(t('tavern.weaponCount', { count: 3, max: 4 })).toBe('3/4 · 上限 4 把');
    });

    it('fills a placeholder that appears twice', () => {
        expect(t('tavern.weaponCount', { count: 1, max: 4 })).toBe('1/4 · max 4 weapons');
    });

    it('keeps each locale’s own word order', () => {
        setLocale('zh-CN');
        expect(t('tavern.enterStage', { stage: 1 })).toBe('↑ 走到传送门进入第 1 关');

        setLocale('en');
        expect(t('tavern.enterStage', { stage: 1 })).toBe(
            '↑ Walk to the teleporter to enter Stage 1',
        );
    });

    it('leaves an unknown placeholder visible instead of printing "undefined"', () => {
        // Only `count` is supplied here; `{max}` must survive verbatim so a
        // typo is obvious on screen rather than silently blank.
        expect(t('tavern.weaponCount', { count: 2 })).toBe('2/{max} · max {max} weapons');
    });

    it('falls back to the key itself for a missing entry', () => {
        expect(t('tavern.nope')).toBe('tavern.nope');
    });
});