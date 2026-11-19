/**
 * tests/lib/characters/skill-summary.test.ts
 * --------------------------------------------------------------------------
 * Every character card in the tavern has to say what the skill does.
 *
 * These assertions read the REAL character YAMLs, so a balance pass that
 * changes a cooldown or a multiplier fails here if the sentence would have gone
 * stale — the card is derived, and this file is what keeps it derived.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCharacterYaml } from '@/lib/characters/parser';
import { skillSummary } from '@/lib/characters/skill-summary';

const DIR = join(process.cwd(), 'public', 'data', 'characters');
const load = (id: string) => parseCharacterYaml(readFileSync(join(DIR, `${id}.yaml`), 'utf8'), id);

describe('the card sentence', () => {
    it('is empty when the character has no skill', () => {
        expect(skillSummary(undefined)).toBeNull();
    });

    it('Claude — 黑化: 20s at double damage, 160 SP, 60s', () => {
        const summary = skillSummary(load('claude').skill)!;
        expect(summary.nameZh).toBe('黑化');
        expect(summary.textZh).toContain('20 秒');
        expect(summary.textZh).toContain('×2');
        expect(summary.textZh).toContain('160 SP');
        expect(summary.textZh).toContain('60 秒');
    });

    it('DeepSeek — 鲸吞: next shot doubled, spent even on a miss', () => {
        const summary = skillSummary(load('deepseek').skill)!;
        expect(summary.nameZh).toBe('鲸吞');
        expect(summary.textZh).toContain('×2');
        expect(summary.textZh).toContain('打空也算');
        expect(summary.textZh).toContain('170 SP');
    });

    it('Gemini — 九命猫: shield that grows with the armour ladder', () => {
        const summary = skillSummary(load('gemini').skill)!;
        expect(summary.nameZh).toBe('九命猫');
        expect(summary.textZh).toContain('15');
        expect(summary.textZh).toContain('90');
        expect(summary.textZh).toContain('碎盾');
    });

    it('GPT — 龙吟: half of MAX HP, a quarter of a boss, a flat 150 SP', () => {
        // 主人 2026-11-14: `改成初始放一次扣150SP，然后扣血对boss减半（小怪扣一半，boss扣1/4）`。
        // It used to read "消耗全部蓝量的 100%", which is what made the cost look like a
        // percentage in the card even though it is one fixed number now.
        const summary = skillSummary(load('gpt').skill)!;
        expect(summary.nameZh).toBe('龙吟');
        expect(summary.textZh).toContain('50%'); // 小怪：一半
        expect(summary.textZh).toContain('25%'); // boss：四分之一
        expect(summary.textZh).toContain('150');
        expect(summary.textZh).not.toContain('100%');
    });

    it('Qwen — 请神术: one free hit, then 20s at 1.5x', () => {
        const summary = skillSummary(load('qwen').skill)!;
        expect(summary.nameZh).toBe('请神术');
        expect(summary.textZh).toContain('1.5');
        expect(summary.textZh).toContain('20 秒');
        expect(summary.textZh).toContain('180 SP');
    });

    it('carries both languages, so the toggle does not leave a blank card', () => {
        for (const id of ['claude', 'deepseek', 'gemini', 'gpt', 'qwen']) {
            const summary = skillSummary(load(id).skill)!;
            expect(summary.name.length, id).toBeGreaterThan(0);
            expect(summary.text.length, id).toBeGreaterThan(0);
            expect(summary.textZh, id).toBe(summary.textZh.trim());
            expect(summary.textZh, id).not.toContain('undefined');
            expect(summary.text, id).not.toContain('undefined');
        }
    });
});
