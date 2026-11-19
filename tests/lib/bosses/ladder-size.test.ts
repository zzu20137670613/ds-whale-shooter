/**
 * tests/lib/bosses/ladder-size.test.ts
 * --------------------------------------------------------------------------
 * How tall she stands in each phase.
 *
 * The owner, after playing it: `bossClaude前四阶段我们约定的都是比正常人物要高半头大一圈的，
 * 只有最后一个阶段才恢复正常Claude大小…实机测试发现…人物大小一模一样`.
 *
 * He is comparing against the player, who draws at 173px (the house rule: cell x scale = 173).
 * The first cut was 198px for phases 1-3 - a 14% difference he could not see. "Half a head
 * taller and a size rounder" is one full ladder step: 281, which is +25%.
 */

import { describe, expect, it } from 'vitest';

import { BOSS_PHASES, spriteHeightForPhase } from '@/lib/bosses/phases';

/** The height every player character is drawn at. */
const PLAYER_PX = 173;

describe('the first four forms', () => {
    it('are visibly taller than the player', () => {
        for (const index of [0, 1, 2]) {
            const height = spriteHeightForPhase(BOSS_PHASES[index]);
            expect(height / PLAYER_PX).toBeGreaterThan(1.5);
        }
    });

    it('are all the same size - she only changes her mind, not her body', () => {
        const first = spriteHeightForPhase(BOSS_PHASES[0]);
        expect(spriteHeightForPhase(BOSS_PHASES[1])).toBe(first);
        expect(spriteHeightForPhase(BOSS_PHASES[2])).toBe(first);
    });

    it('step down once at 半神半人, but stay above the player', () => {
        const fourth = spriteHeightForPhase(BOSS_PHASES[3]);
        expect(fourth).toBeLessThan(spriteHeightForPhase(BOSS_PHASES[2]));
        expect(fourth).toBeGreaterThan(PLAYER_PX);
    });
});

describe('the last form', () => {
    it('is the shortest form, still taller than the player', () => {
        expect(spriteHeightForPhase(BOSS_PHASES[3])).toBe(235);
    });
});

describe('the ladder never inverts', () => {
    it('only ever shrinks as she is brought down', () => {
        const heights = BOSS_PHASES.map(spriteHeightForPhase);
        for (let i = 1; i < heights.length; i += 1) {
            expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]);
        }
    });
});