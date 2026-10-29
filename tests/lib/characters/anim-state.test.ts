/**
 * tests/lib/characters/anim-state.test.ts
 * --------------------------------------------------------------------------
 * A stopped animation still reports its key, so "same key" must not mean "already
 * playing". Missing that is what made the character slide around in a still pose.
 */

import { describe, expect, it } from 'vitest';

import { needsAnimPlay } from '@/lib/characters/anim-state';

describe('needsAnimPlay', () => {
    it('starts a different animation', () => {
        expect(needsAnimPlay('gpt-idle', 'gpt-walk', true)).toBe(true);
    });

    it('does nothing when that animation is already running', () => {
        expect(needsAnimPlay('gpt-walk', 'gpt-walk', true)).toBe(false);
    });

    it('restarts the same key when it was stopped - the frozen-pose bug', () => {
        expect(needsAnimPlay('gpt-walk', 'gpt-walk', false)).toBe(true);
    });

    it('starts an animation when nothing is current', () => {
        expect(needsAnimPlay(null, 'gpt-walk', false)).toBe(true);
    });
});