/**
 * tests/lib/bosses/phase-reward.test.ts
 * --------------------------------------------------------------------------
 * What clearing one of Claude's phases pays out.
 *
 * The owner: `打boss战Claude时，每打过一个阶段，弹药自动补满（只有第四阶段打完时自动补满血蓝，
 * 前三个阶段打完只补满所有武器的弹药/备弹）`.
 *
 * So ammunition is a per-phase reward - every bar she loses hands the player a full clip and
 * a full reserve for every gun they carry - but health and spirit are only topped up from
 * phase four on, which is the beat before her final form. Refilling vitals after every phase
 * would make the gauntlet trivial.
 *
 * The rule is a pure function of the phase that was just cleared, so it can be read without a
 * Phaser scene: `clearedIndex` is zero-based, `vitalsFromPhase` is the one-based phase number
 * from which vitals come along.
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_PHASE_CLEAR_EVENT,
    VITALS_REFILL_FROM_PHASE,
    phaseClearReward,
} from '@/lib/bosses/phase-reward';

describe('phaseClearReward', () => {
    it('always refills ammunition - every phase, no exceptions', () => {
        for (let cleared = 0; cleared < 5; cleared++) {
            expect(phaseClearReward(cleared).ammo).toBe(true);
        }
    });

    it('keeps the first three phases to ammunition only', () => {
        // Zero-based: 0/1/2 are phases 1, 2 and 3.
        expect(phaseClearReward(0).vitals).toBe(false);
        expect(phaseClearReward(1).vitals).toBe(false);
        expect(phaseClearReward(2).vitals).toBe(false);
    });

    it('tops the vitals up once phase four falls', () => {
        expect(phaseClearReward(3).vitals).toBe(true);
    });

    it('keeps refilling vitals after that, so the final kill is not a sudden stop', () => {
        expect(phaseClearReward(4).vitals).toBe(true);
    });

    it('takes its threshold as a parameter, so a shorter fight can say so', () => {
        expect(phaseClearReward(2, 3).vitals).toBe(true);
        expect(phaseClearReward(1, 3).vitals).toBe(false);
    });

    it('names the event the boss emits when a bar empties', () => {
        expect(BOSS_PHASE_CLEAR_EVENT).toBe('boss:phase-cleared');
    });

    it('reads its default threshold from one constant', () => {
        expect(VITALS_REFILL_FROM_PHASE).toBe(4);
    });
});