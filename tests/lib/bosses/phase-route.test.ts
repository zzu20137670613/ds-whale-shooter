/**
 * tests/lib/bosses/phase-route.test.ts
 * --------------------------------------------------------------------------
 * Where each phase of the fight happens.
 *
 * The owner, correcting my last build:
 *   `第二阶段神·Claude直接接续上灭世·Claude，原地复活，之后第三阶段半神半人才开始换地方，
 *    你现在是神·Claude直接换地方了，并且你直接把第五阶段给取消掉了`.
 *
 * The bug was an off-by-one: I indexed `arenaSpawn` by phaseIndex, which moved 神 (phase 2) to
 * spot 1 and left 克劳德 (phase 5) with no spot at all. The level authors FOUR spots for FIVE
 * phases because the first two share one.
 */

import { describe, expect, it } from 'vitest';

import { arenaSpotIndexForPhase } from '@/lib/bosses/arena';
import { BOSS_PHASES } from '@/lib/bosses/phases';

const SPOTS = 4;

describe('the route', () => {
    it('keeps 神 where 灭世 fell - she comes back on the spot', () => {
        expect(arenaSpotIndexForPhase(0, SPOTS)).toBe(0);
        expect(arenaSpotIndexForPhase(1, SPOTS)).toBe(0);
    });

    it('moves her from 半神 onward', () => {
        expect(arenaSpotIndexForPhase(2, SPOTS)).toBe(1);
        expect(arenaSpotIndexForPhase(3, SPOTS)).toBe(2);
        expect(arenaSpotIndexForPhase(4, SPOTS)).toBe(3);
    });

    it('gives every phase its own spot', () => {
        expect(BOSS_PHASES).toHaveLength(4);
        expect(arenaSpotIndexForPhase(4, SPOTS)).not.toBeNull();
    });

    it('never sends two MOVING phases to the same place', () => {
        const moving = [2, 3, 4].map((p) => arenaSpotIndexForPhase(p, SPOTS));
        expect(new Set(moving).size).toBe(moving.length);
    });

    it('every phase after the first two has a spot, with four authored', () => {
        for (const phase of [2, 3, 4]) {
            expect(arenaSpotIndexForPhase(phase, SPOTS)).not.toBeNull();
        }
    });

    it('reports null rather than a bad index when a level authors too few spots', () => {
        expect(arenaSpotIndexForPhase(4, 2)).toBeNull();
        expect(arenaSpotIndexForPhase(0, 0)).toBeNull();
    });
});