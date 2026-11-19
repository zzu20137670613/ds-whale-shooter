/**
 * tests/lib/characters/skill-castable.test.ts
 * --------------------------------------------------------------------------
 * 手机实测 GPT：`升级之后技能放不出来了，初始的时候是能放出来的`.
 *
 * The roar is charged as a fraction of the pool (`spCostFraction: 1`), so its price is the
 * whole bar. The price also grows +10 SP per upgrade level - and that level used to be read
 * from the ARMOUR ladder, which raises no SP at all. One armour level put the price 10 above
 * the entire pool, and `canUseSkill` then answered "no" for the rest of the run, because SP
 * can never exceed its maximum.
 *
 * These tests pin both halves of the fix: the cost rides the ladder that grows the pool
 * (spirit), and a price can never exceed the bar it is paid from.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { canUseSkill, emptySkillRuntime, skillSpCost } from '@/lib/characters/skill';
import { scaledSkillSpCost, skillLadders } from '@/lib/characters/skill-scaling';
import { parseCharacterYaml } from '@/lib/characters/parser';

const ROOT = process.cwd();

function gpt(): ReturnType<typeof parseCharacterYaml> {
    const yaml = readFileSync(join(ROOT, 'public', 'data', 'characters', 'gpt.yaml'), 'utf8');
    return parseCharacterYaml(yaml, 'gpt');
}

/** The price the press actually charges, exactly as the controller computes it. */
function chargedPrice(
    spec: ReturnType<typeof parseCharacterYaml>,
    levels: Record<string, number>,
): number {
    const ladders = skillLadders(levels);
    return scaledSkillSpCost(skillSpCost(spec.skill, spec.sp), ladders.cost, spec.sp);
}

/** The pool after the spirit ladder has run: the only ladder that raises SP. */
function poolAfter(
    spec: ReturnType<typeof parseCharacterYaml>,
    levels: Record<string, number>,
): number {
    const perLevel =
        spec.upgrades?.spirit?.effects.find((effect) => effect.stat === 'sp')?.perLevel ?? 0;
    return spec.sp + perLevel * (levels.spirit ?? 0);
}

describe('GPT 龙吟 after a single upgrade', () => {
    it('is still castable with one armour level bought', () => {
        const spec = gpt();
        const levels = { armor: 1 };
        expect(chargedPrice(spec, levels)).toBeLessThanOrEqual(spec.sp);
    });

    it('is still castable with the whole ladder bought', () => {
        const spec = gpt();
        for (let armor = 0; armor <= 5; armor += 1) {
            for (let spirit = 0; spirit <= 5; spirit += 1) {
                const levels = { armor, spirit };
                const price = chargedPrice(spec, levels);
                const pool = poolAfter(spec, levels);
                expect(
                    price,
                    `armor ${armor} / spirit ${spirit}: ${price} SP of ${pool}`,
                ).toBeLessThanOrEqual(pool);
            }
        }
    });

    it('stays castable at a full bar on every combination', () => {
        const spec = gpt();
        const runtime = emptySkillRuntime();
        for (let armor = 0; armor <= 5; armor += 1) {
            for (let spirit = 0; spirit <= 5; spirit += 1) {
                const levels = { armor, spirit };
                const pool = poolAfter(spec, levels);
                const price = chargedPrice(spec, levels);
                expect(
                    canUseSkill(spec.skill, runtime, 0, pool, pool, price),
                    `armor ${armor} / spirit ${spirit}: ${price} SP of ${pool}`,
                ).toBe(true);
            }
        }
    });

    it('is still castable when the SP pool itself is raised but not refilled', () => {
        // The reported bug in its purest form: buy spirit once, the bar now reads 180/190 and
        // `sp >= cost` fails even though the player sees a nearly full bar.
        const spec = gpt();
        const levels = { spirit: 1 };
        const pool = poolAfter(spec, levels);
        const price = chargedPrice(spec, levels);
        expect(pool - 10).toBeGreaterThanOrEqual(price);
    });
});

describe('the cost ladder', () => {
    it('rides spirit, so the price grows with the pool it is paid from', () => {
        expect(skillLadders({ armor: 4, spirit: 2 })).toEqual({ cost: 2, cooldown: 4 });
    });

    it('reads armour for the cooldown only', () => {
        expect(skillLadders({ armor: 5 }).cost).toBe(0);
        expect(skillLadders({ spirit: 5 }).cooldown).toBe(0);
    });

    it('defaults to zero for anything missing or nonsense', () => {
        expect(skillLadders()).toEqual({ cost: 0, cooldown: 0 });
        expect(skillLadders({ armor: -2, spirit: Number.NaN })).toEqual({ cost: 0, cooldown: 0 });
        expect(skillLadders({ armor: 2.7, spirit: 1.2 })).toEqual({ cost: 1, cooldown: 2 });
    });
});

describe('a price can never exceed the bar', () => {
    it('caps at the pool when a cap is given', () => {
        expect(scaledSkillSpCost(180, 5, 180)).toBe(180);
        expect(scaledSkillSpCost(170, 5, 240)).toBe(220);
    });

    it('leaves the price alone without a cap', () => {
        expect(scaledSkillSpCost(180, 5)).toBe(230);
    });

    it('treats a nonsense cap as no cap', () => {
        expect(scaledSkillSpCost(180, 5, Number.NaN)).toBe(230);
        // A pool of 0 cannot pay for anything, but it must not turn the skill free either:
        // an unusable cap is ignored, not obeyed.
        expect(scaledSkillSpCost(180, 5, 0)).toBe(230);
        expect(scaledSkillSpCost(180, 5, -4)).toBe(230);
    });
});
