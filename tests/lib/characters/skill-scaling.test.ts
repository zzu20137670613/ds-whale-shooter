/**
 * tests/lib/characters/skill-scaling.test.ts
 * --------------------------------------------------------------------------
 * The skill's price and cooldown follow the character's upgrade level: +10 SP and
 * -2s per level, with a floor so the cooldown cannot reach zero.
 */

import { describe, expect, it } from 'vitest';

import { scaledSkillCooldown, scaledSkillSpCost } from '@/lib/characters/skill-scaling';
import { SKILL_MIN_COOLDOWN_MS } from '@/lib/constants';

describe('scaledSkillSpCost', () => {
    it('adds 10 per level', () => {
        expect(scaledSkillSpCost(15, 0)).toBe(15);
        expect(scaledSkillSpCost(15, 1)).toBe(25);
        expect(scaledSkillSpCost(15, 5)).toBe(65);
    });

    it('rounds a fractional base up, because SP is spent in whole points', () => {
        expect(scaledSkillSpCost(10.2, 0)).toBe(11);
    });

    it('ignores negative levels and costs', () => {
        expect(scaledSkillSpCost(15, -3)).toBe(15);
        expect(scaledSkillSpCost(-5, 2)).toBe(20);
    });
});

describe('scaledSkillCooldown', () => {
    it('takes two seconds off per level', () => {
        expect(scaledSkillCooldown(12000, 0)).toBe(12000);
        expect(scaledSkillCooldown(12000, 1)).toBe(10000);
        expect(scaledSkillCooldown(12000, 5)).toBe(2000);
    });

    it('never drops below the floor', () => {
        expect(scaledSkillCooldown(3000, 5)).toBe(SKILL_MIN_COOLDOWN_MS);
        expect(scaledSkillCooldown(500, 4)).toBe(SKILL_MIN_COOLDOWN_MS);
    });

    it('leaves a skill that is already instant alone', () => {
        expect(scaledSkillCooldown(0, 3)).toBe(SKILL_MIN_COOLDOWN_MS);
    });
});