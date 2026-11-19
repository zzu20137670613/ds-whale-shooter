// @vitest-environment happy-dom
/**
 * tests/store/input-scheme.test.ts
 * --------------------------------------------------------------------------
 * Which half of the input redesign is live, and that the choice survives a reload.
 *
 * The switch is a preference, not a runtime mode: it is read every frame by the
 * character controller, so "the mouse kept aiming after I picked arrows" would be a
 * silent bug rather than a visible one.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { initialGameState, useGameStore } from '@/store/game-store';

describe('inputScheme', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('starts on the mouse, which is the desktop default', () => {
        expect(useGameStore.getState().inputScheme).toBe('mouse');
    });

    it('switches to the arrow keys and back', () => {
        useGameStore.getState().setInputScheme('directional');
        expect(useGameStore.getState().inputScheme).toBe('directional');

        useGameStore.getState().setInputScheme('mouse');
        expect(useGameStore.getState().inputScheme).toBe('mouse');
    });

    it('is written into the save', () => {
        // The persisted slice is what rehydrates; a scheme missing from it would
        // reset to 'mouse' on every reload.
        useGameStore.getState().setInputScheme('directional');
        const persisted = JSON.parse(
            window.localStorage.getItem('ds_whale_shooter_save_v2') ?? '{}',
        ) as { state?: { inputScheme?: string } };
        expect(persisted.state?.inputScheme).toBe('directional');
    });
});