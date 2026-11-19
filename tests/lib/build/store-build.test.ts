/**
 * tests/lib/build/store-build.test.ts
 * --------------------------------------------------------------------------
 * The store-build flag decides whether the shipped bundle contains an outbound call at all.
 *
 * The rule that matters: **absent means off**. A build that forgets to export the variable must
 * behave like the normal game, not like a build that quietly strips the repo link and the letter
 * form from a developer's local run. The other direction matters too - `"0"`, `"false"` and the
 * empty string are all "off" even though they are truthy strings.
 */

import { describe, expect, it } from 'vitest';

import { readStoreBuild } from '@/lib/build/store-build';

describe('readStoreBuild', () => {
    it('is off when the variable is missing', () => {
        expect(readStoreBuild({})).toBe(false);
        expect(readStoreBuild(undefined)).toBe(false);
        expect(readStoreBuild(null)).toBe(false);
    });

    it('is on for every spelling the build scripts use', () => {
        expect(readStoreBuild({ VITE_STORE_BUILD: '1' })).toBe(true);
        expect(readStoreBuild({ VITE_STORE_BUILD: 'true' })).toBe(true);
        expect(readStoreBuild({ VITE_STORE_BUILD: 1 })).toBe(true);
        expect(readStoreBuild({ VITE_STORE_BUILD: true })).toBe(true);
    });

    it('stays off for the falsy-looking strings a shell can hand over', () => {
        expect(readStoreBuild({ VITE_STORE_BUILD: '0' })).toBe(false);
        expect(readStoreBuild({ VITE_STORE_BUILD: 'false' })).toBe(false);
        expect(readStoreBuild({ VITE_STORE_BUILD: '' })).toBe(false);
        expect(readStoreBuild({ VITE_STORE_BUILD: 'yes' })).toBe(false);
    });

    it('is off in a plain test run, so the normal game keeps its chip and its form', () => {
        expect(readStoreBuild({ VITE_STORE_BUILD: undefined })).toBe(false);
    });
});
