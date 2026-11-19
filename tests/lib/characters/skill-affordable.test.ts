/**
 * tests/lib/characters/skill-affordable.test.ts
 * --------------------------------------------------------------------------
 * A fully upgraded skill has to still fit in her own SP pool.
 *
 * This is the guard the price change needed and did not have. Skill cost rises 10 per level
 * while the pool rises 10 per level too (the spirit ladder), so the two have to be read from
 * the same ladder - they were not: the cost followed ARMOUR, which raises no SP at all, and a
 * fully upgraded Claude skill wanted 110 of her 70.
 *
 * Reads the shipped YAML, so a re-price in the data sheet cannot quietly break this again.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scaledSkillSpCost } from '@/lib/characters/skill-scaling';

const ROOT = process.cwd();
const CHARACTERS = ['deepseek', 'claude', 'gpt', 'qwen', 'gemini'] as const;

interface Sheet {
    sp: number;
    /** Base SP price of the skill, or null when it is charged as a fraction of the pool. */
    spCost: number | null;
    /** `spCostFraction` for a pool-scaled price (GPT's roar is 1 - the whole bar). */
    spCostFraction: number | null;
    spiritPerLevel: number;
    spiritLevels: number;
}

function sheet(id: string): Sheet {
    const yaml = readFileSync(join(ROOT, 'public', 'data', 'characters', `${id}.yaml`), 'utf8');

    const sp = Number(/^sp:\s*([\d.]+)$/m.exec(yaml)?.[1] ?? 0);
    const spiritBlock = /^\s{4}spirit:\n([\s\S]*?)(?=^\s{4}\w+:|^\w)/m.exec(yaml)?.[1] ?? '';
    const spiritLevels = (spiritBlock.match(/\[([^\]]+)\]/)?.[1] ?? '').split(',').length;
    const spiritPerLevel = Number(
        /stat: sp, mode: add, perLevel: ([\d.]+)/.exec(spiritBlock)?.[1] ?? 0,
    );
    const skillBlock = /^skill:\n([\s\S]*?)(?=^\w)/m.exec(yaml)?.[1] ?? '';
    const cost = /^\s+spCost:\s*(\d+)$/m.exec(skillBlock)?.[1];
    const fraction = /^\s+spCostFraction:\s*([\d.]+)$/m.exec(skillBlock)?.[1];

    return {
        sp,
        spCost: cost === undefined ? null : Number(cost),
        spCostFraction: fraction === undefined ? null : Number(fraction),
        spiritPerLevel,
        spiritLevels,
    };
}

describe('a maxed skill still fits her SP bar', () => {
    for (const id of CHARACTERS) {
        it(`${id} can afford her own skill at spirit ${id === 'gpt' ? 'max' : 'max'}`, () => {
            const s = sheet(id);
            const pool = s.sp + s.spiritPerLevel * s.spiritLevels;

            // A pool-scaled price is the pool times its fraction - exactly what
            // `skillSpCost` charges at that level. Treating it as "scales by construction"
            // was wrong and let GPT's roar go permanently uncastable (`升级之后技能放不出来了`,
            // 2026-11-14): the pool grew 10 a level, the price grew 10 on top of it.
            const base =
                s.spCost ??
                Math.ceil((s.spCostFraction ?? 0) * (s.sp + s.spiritPerLevel * s.spiritLevels));

            const price = scaledSkillSpCost(base, s.spiritLevels, pool);
            expect(price, `${id}: ${price} SP against a ${pool} pool`).toBeLessThanOrEqual(pool);
        });
    }

    it('the price really does rise with the ladder (otherwise this test is vacuous)', () => {
        expect(scaledSkillSpCost(70, 5)).toBe(120);
        expect(scaledSkillSpCost(70, 0)).toBe(70);
    });
});
