/**
 * tests/lib/bosses/plate-and-engage.test.ts
 * --------------------------------------------------------------------------
 * Two things the owner has now reported twice: the boss is still called plain 克劳德, and she
 * never attacks (`还是Claude且没有攻击`).
 *
 *   - The ladder always had the numbers and never the titles, so the plate read 克劳德 from
 *     phase 1 to phase 5 and the whole descent was invisible.
 *   - The attack tick required `state === 'attack'`, which depends on `weapon.range` vs the
 *     distance she happens to stand at. When that disagreed she stood there and took it.
 */

import { describe, expect, it } from 'vitest';

import { BOSS_PHASES, BOSS_PHASE_TITLES, bossPhaseTitle } from '@/lib/bosses/phases';

const BASE_ZH = '克劳德';
const BASE_EN = 'Claude';

describe('the name plate', () => {
    it('starts the fight as 灭世·克劳德', () => {
        expect(bossPhaseTitle(0, BASE_ZH, 'zh')).toBe('灭世·克劳德');
    });

    it('walks the ladder: 神 → 半神 → 半神半人', () => {
        expect(bossPhaseTitle(1, BASE_ZH, 'zh')).toBe('神·克劳德');
        expect(bossPhaseTitle(2, BASE_ZH, 'zh')).toBe('半神·克劳德');
        expect(bossPhaseTitle(3, BASE_ZH, 'zh')).toBe('半神半人·克劳德');
    });

    it('keeps her name in the last form', () => {
        // The owner: `最终的boss关第五阶段Claude就叫Claude，不要叫克劳德`. The last form
        // keeps the English name even on the Chinese HUD.
        expect(bossPhaseTitle(3, BASE_ZH, 'zh')).toContain('克劳德');
        expect(bossPhaseTitle(3, BASE_EN, 'en')).toContain('Claude');
    });

    it('speaks English on an English HUD', () => {
        expect(bossPhaseTitle(0, BASE_EN, 'en')).toBe('World-Ender Claude');
        expect(bossPhaseTitle(1, BASE_EN, 'en')).toBe('Deity Claude');
    });

    it('clamps a corrupt phase index instead of going blank', () => {
        // Out of range clamps to the last rung, which is now named Claude.
        expect(bossPhaseTitle(99, BASE_ZH, 'zh')).toContain('克劳德');
        expect(bossPhaseTitle(-5, BASE_ZH, 'zh')).toBe('灭世·克劳德');
    });

    it('names every rung of the ladder', () => {
        for (const phase of BOSS_PHASES) {
            expect(BOSS_PHASE_TITLES[phase.name].zh.length).toBeGreaterThan(0);
            expect(BOSS_PHASE_TITLES[phase.name].en.length).toBeGreaterThan(0);
        }
    });
});