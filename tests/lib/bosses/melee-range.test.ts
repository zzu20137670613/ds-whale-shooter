/**
 * tests/lib/bosses/melee-range.test.ts
 * --------------------------------------------------------------------------
 * The boss was swinging a 96px hitbox at a player 663px away.
 *
 * The owner's `?bossDebug=1` readout is the evidence:
 *
 *     phase=3  state=attack  dist=663  range=700  gapMs=2000
 *     sinceAttackMs=1716  invulnerableMs=0  lastAttack=melee
 *
 * She WAS attacking, every two seconds, and always `melee`. The cause: `performBossAttack`
 * measured distance with `Math.hypot(dirToPlayer.x, dirToPlayer.y)`, and `dirTo` returns a
 * UNIT vector - so the distance was 1, and 1 is always inside a 96px swing.
 */

import { describe, expect, it } from 'vitest';

import { BOSS_MELEE_REACH, isBossMeleeRange } from '@/lib/bosses/attacks';

describe('isBossMeleeRange', () => {
    it('is false at the distance in the debug readout', () => {
        expect(isBossMeleeRange(663)).toBe(false);
    });

    it('is true only inside arm’s length', () => {
        expect(isBossMeleeRange(BOSS_MELEE_REACH - 1)).toBe(true);
        expect(isBossMeleeRange(BOSS_MELEE_REACH)).toBe(true);
        expect(isBossMeleeRange(BOSS_MELEE_REACH + 1)).toBe(false);
    });

    it('would have said "melee" for a unit vector - the bug, written down', () => {
        // This is exactly what the controller used to feed it.
        expect(isBossMeleeRange(1)).toBe(true);
    });

    it('never melees on a broken measurement', () => {
        expect(isBossMeleeRange(Number.NaN)).toBe(false);
        expect(isBossMeleeRange(Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('takes a custom reach, for future phases with longer arms', () => {
        expect(isBossMeleeRange(150, 200)).toBe(true);
        expect(isBossMeleeRange(150, 96)).toBe(false);
    });
});