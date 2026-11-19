/**
 * tests/lib/pet/badge.test.ts
 * --------------------------------------------------------------------------
 * The chip has to say what the buff actually is, and has to disappear when there is no buff.
 *
 * Numbers straight from the shipped thresholds: the ladder is +0 / +1 / +2 luck at 0 / 20 /
 * 50 percent, and the blessing (damage ×1.5, cooldown ×0.5, regen) only at 50.
 */

import { describe, expect, it } from 'vitest';

import { petBuffFacts } from '@/lib/pet/badge';

describe('petBuffFacts', () => {
    it('shows nothing when no pet answered', () => {
        expect(petBuffFacts(null, 'deepseek')).toBeNull();
        expect(petBuffFacts(undefined, 'deepseek')).toBeNull();
        expect(petBuffFacts(0, 'deepseek')).toBeNull();
    });

    it('shows nothing for a character the pet does not companion', () => {
        expect(petBuffFacts(50, 'qwen')).toBeNull();
        expect(petBuffFacts(50, undefined)).toBeNull();
    });

    it('reports the panel percentage and the ladder luck', () => {
        const low = petBuffFacts(20, 'deepseek');
        expect(low?.percent).toBe(20);
        // 20% is the mobile floor and it buys the first point now.
        expect(low?.luck).toBe(1);
        expect(low?.blessing).toBe(false);

        expect(petBuffFacts(30, 'deepseek')?.luck).toBe(1);
        expect(petBuffFacts(40, 'deepseek')?.luck).toBe(1);
    });

    it('turns on the four extras at the top tier', () => {
        const facts = petBuffFacts(50, 'deepseek');
        expect(facts?.blessing).toBe(true);
        expect(facts?.luck).toBe(2);
        expect(facts?.damageMul).toBe(1.5);
        expect(facts?.cooldownMul).toBe(0.5);
        expect(facts?.hpRegenPerSecPct).toBe(0.02);
        expect(facts?.spRegenPerSecPct).toBe(0.01);
    });

    it('leaves the extras off below the top tier', () => {
        const facts = petBuffFacts(40, 'deepseek');
        expect(facts?.blessing).toBe(false);
        expect(facts?.damageMul).toBe(1);
        expect(facts?.cooldownMul).toBe(1);
        expect(facts?.hpRegenPerSecPct).toBe(0);
        expect(facts?.spRegenPerSecPct).toBe(0);
    });
});