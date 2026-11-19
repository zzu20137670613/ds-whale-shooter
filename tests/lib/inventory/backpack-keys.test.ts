/**
 * tests/lib/inventory/backpack-keys.test.ts
 * --------------------------------------------------------------------------
 * B and I both open the bag.
 *
 * The owner: `给背包加个I键（I键，B键都是背包键）`. B was the only key and the only hint the
 * HUD printed; hands rest on I in most shooters, so both toggle now - and neither may depend
 * on caps lock or Shift.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { KEY_BACKPACK } from '@/lib/constants';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the key list', () => {
    it('has both keys', () => {
        expect(KEY_BACKPACK).toContain('b');
        expect(KEY_BACKPACK).toContain('i');
    });

    it('is lower-case, because the handler lower-cases what it receives', () => {
        for (const key of KEY_BACKPACK) expect(key).toBe(key.toLowerCase());
    });
});

describe('the overlay', () => {
    const overlay = () => read('src', 'components', 'hud', 'backpack-overlay.tsx');

    it('toggles on any key in the list', () => {
        expect(overlay()).toContain('KEY_BACKPACK.includes(e.key.toLowerCase())');
        // The old single-key test must be gone, or I would never reach the handler.
        expect(overlay()).not.toContain("e.key === 'b' || e.key === 'B'");
    });

    it('still closes on Escape', () => {
        expect(overlay()).toContain("e.key === 'Escape'");
    });
});

describe('the hint', () => {
    it('names both keys in Chinese', () => {
        expect(read('src', 'locales', 'zh-CN.ts')).toContain("bagKey: 'B / I 背包'");
    });

    it('and in English', () => {
        expect(read('src', 'locales', 'en.ts')).toContain("bagKey: 'B / I · Backpack'");
    });
});