/**
 * tests/lib/characters/walk-direction.test.ts
 * --------------------------------------------------------------------------
 * A character may ship a separate left-facing walk row.
 *
 * The owner's plan: rather than ask the generator for a side-view walk, hand-mirror the art
 * himself and ship both directions as real rows. When a `walkLeft` track exists the walk is
 * no longer mirrored - the row already faces the right way - and the facing decides which row
 * plays.
 *
 * Without `walkLeft` nothing changes: one `walk` row, mirrored on a left move.
 */

import { describe, expect, it } from 'vitest';

import { walkTrackFor } from '@/lib/characters/walk-direction';

describe('walkTrackFor', () => {
    it('uses the single walk row when the character has no left row', () => {
        expect(walkTrackFor('right', false)).toBe('walk');
        expect(walkTrackFor('left', false)).toBe('walk');
    });

    it('picks the row that matches the facing when both exist', () => {
        expect(walkTrackFor('right', true)).toBe('walk');
        expect(walkTrackFor('left', true)).toBe('walkLeft');
    });
});