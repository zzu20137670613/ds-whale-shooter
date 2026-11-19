/**
 * tests/lib/levels/portals.test.ts
 * --------------------------------------------------------------------------
 * The seal-key door exists only once it is earned.
 *
 * The owner has reported this twice: first that the key was printed on screen, now that the
 * portal is already standing in the pavilion on a fresh save (`开局 deepseek1314 这个隐藏传送
 * 阵就显示了`). Both times the rule was right somewhere and missing at the call site, so the
 * rule now lives in one pure function and the scene asks it twice: once when the level's
 * first batch of portals is built, once on every later sync.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPortalVisible, visibleTeleporters } from '@/lib/levels/portals';
import type { Teleporter } from '@/lib/levels';

const ROOT = process.cwd();

const open: Teleporter = { id: 'tavern-exit', x: 1355, y: 1425, radius: 60, requiresClear: false };
const hidden: Teleporter = {
    id: 'hidden-whale-entrance',
    x: 1918,
    y: 520,
    radius: 60,
    requiresClear: false,
    hiddenUnlessUnlocked: true,
};

describe('a locked save', () => {
    it('does not get the hidden door drawn', () => {
        expect(isPortalVisible(hidden, false)).toBe(false);
        expect(visibleTeleporters([open, hidden], false)).toEqual([open]);
    });

    it('keeps every ordinary portal', () => {
        expect(visibleTeleporters([open], false)).toEqual([open]);
    });
});

describe('an unlocked save', () => {
    it('gets it, with no other change', () => {
        expect(isPortalVisible(hidden, true)).toBe(true);
        expect(visibleTeleporters([open, hidden], true)).toEqual([open, hidden]);
    });
});

describe('the edges', () => {
    it('treats a missing list as no portals', () => {
        expect(visibleTeleporters(undefined, false)).toEqual([]);
        expect(visibleTeleporters(undefined, true)).toEqual([]);
    });

    it('leaves the input array untouched', () => {
        const specs = [open, hidden];
        visibleTeleporters(specs, false);
        expect(specs).toHaveLength(2);
    });
});

describe('the scene asks the rule twice', () => {
    const source = readFileSync(
        join(ROOT, 'src', 'game', 'scenes', 'teleporter.ts'),
        'utf8',
    );

    it('when the first batch of portals is built', () => {
        // The constructor drew from the raw list, which is what put the circle in the
        // pavilion on a fresh save.
        expect(source).toMatch(/for \(const spec of visibleTeleporters\(teleporterSpecs, unlocked\)\)/);
    });

    it('and again on every later sync', () => {
        expect(source).toMatch(
            /specs = visibleTeleporters\(specs, useGameStore\.getState\(\)\.hiddenMapUnlocked\)/,
        );
    });
});