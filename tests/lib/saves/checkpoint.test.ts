/**
 * tests/lib/saves/checkpoint.test.ts
 * --------------------------------------------------------------------------
 * The "map cleared" checkpoint. `自动存档也优化一下，在每关清理完所有怪物出传送阵的这个
 * 触发点，触发一次自动存档` - once, at the moment the exit portal fades in.
 */

import { describe, expect, it } from 'vitest';

import { shouldSaveOnClear } from '@/lib/saves/checkpoint';

const base = {
    cleared: true,
    hasAppeared: false,
    alreadySaved: false,
    editorActive: false,
};

describe('the clear checkpoint', () => {
    it('fires the first time a cleared map shows its exit portal', () => {
        expect(shouldSaveOnClear(base)).toBe(true);
    });

    it('does nothing while monsters are alive', () => {
        expect(shouldSaveOnClear({ ...base, cleared: false })).toBe(false);
    });

    it('does not fire twice for the same visit', () => {
        // A second portal on the same map fades in after the first save.
        expect(shouldSaveOnClear({ ...base, alreadySaved: true })).toBe(false);
    });

    it('does not fire for a portal that already faded in', () => {
        // Re-entering an already-finished map: nothing new happened.
        expect(shouldSaveOnClear({ ...base, hasAppeared: true })).toBe(false);
    });

    it('never fires from the level editor', () => {
        expect(shouldSaveOnClear({ ...base, editorActive: true })).toBe(false);
    });

    it('is not confused by an editor that is open AND cleared', () => {
        expect(shouldSaveOnClear({ ...base, editorActive: true, cleared: true })).toBe(false);
    });
});