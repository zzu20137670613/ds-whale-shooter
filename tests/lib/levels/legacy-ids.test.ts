/**
 * tests/lib/levels/legacy-ids.test.ts
 * --------------------------------------------------------------------------
 * A save written before the 2x2 split still names `starry-library`, a file that no longer
 * exists. Without a redirect the level fetch 404s and the run cannot resume, so the loader
 * maps retired ids onto the level that replaced them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LEGACY_LEVEL_IDS, resolveLevelId } from '@/lib/levels/loader';
import { parseLevelIndex } from '@/lib/levels/parser';

const ROOT = process.cwd();

describe('ids retired by the 2x2 split', () => {
    it('sends the old 4x4 library id to its first tile', () => {
        expect(resolveLevelId('starry-library')).toBe('starry-library-1-entrance');
    });

    it('leaves ids that still exist alone', () => {
        for (const id of ['starry-library-3-terrace', 'beach-holiday', 'tavern']) {
            expect(resolveLevelId(id), id).toBe(id);
        }
    });

    it('only points at levels the index lists', () => {
        const index = parseLevelIndex(
            readFileSync(join(ROOT, 'public', 'data', 'levels', 'index.yaml'), 'utf8'),
        );
        for (const target of Object.values(LEGACY_LEVEL_IDS)) {
            expect(index.levels, target).toContain(target);
        }
    });
});