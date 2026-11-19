/**
 * tests/lib/bosses/level-phases.test.ts
 * --------------------------------------------------------------------------
 * One map per phase.
 *
 * The owner, 2026-11-12: `我们把地图拆了，然后四关匹配 boss Claude 4 阶段，最后一个阶段取消，
 * 实测发现都在第一关，没有分到 4 关里`。
 *
 * Two things were missing and both are pinned here:
 *   - a level never told the arena which phase it owns, so every one of the four maps started
 *     at 灭世 and ran the whole ladder;
 *   - clearing a phase always advanced to the next form instead of ending the fight, so the
 *     first map could be played through all four bars.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BOSS_PHASES,
    bossPhaseIsFinal,
    bossSettlementDue,
    bossStartPhaseIndex,
} from '@/lib/bosses/phases';
import { parseLevelYaml } from '@/lib/levels/parser';

const ROOT = process.cwd();
const load = (id: string) =>
    parseLevelYaml(readFileSync(join(ROOT, 'public', 'data', 'levels', `${id}.yaml`), 'utf8'), id);

const LEVELS = [
    ['warhammer-redeem-1-chapel', 1],
    ['warhammer-redeem-2-warship', 2],
    ['warhammer-redeem-3-fireworks', 3],
    ['warhammer-redeem-4-first-meeting', 4],
] as const;

describe('the four boss maps', () => {
    it.each(LEVELS)('%s owns phase %i', (id, phase) => {
        const level = load(id);
        expect(level.boss, 'is a boss level').toBeDefined();
        expect(level.bossPhase).toBe(phase);
        expect(bossStartPhaseIndex(level.bossPhase)).toBe(phase - 1);
    });

    it('lands on the four surviving phases after the fifth was cut', () => {
        expect(BOSS_PHASES).toHaveLength(4);
        for (const [, phase] of LEVELS) {
            expect(bossStartPhaseIndex(phase)).toBeLessThan(BOSS_PHASES.length);
        }
    });
});

describe('bossStartPhaseIndex', () => {
    it('treats a missing phase as map one', () => {
        expect(bossStartPhaseIndex(undefined)).toBe(0);
    });

    it('clamps values a corrupt save or a typo could carry', () => {
        expect(bossStartPhaseIndex(0)).toBe(0);
        expect(bossStartPhaseIndex(-3)).toBe(0);
        expect(bossStartPhaseIndex(99)).toBe(BOSS_PHASES.length - 1);
    });
});

describe('bossPhaseIsFinal', () => {
    it('ends the fight when a map clears the phase it owns', () => {
        for (const [, phase] of LEVELS) {
            expect(bossPhaseIsFinal(phase, bossStartPhaseIndex(phase))).toBe(true);
        }
    });

    it('never lets one map walk into the next map\u2019s form', () => {
        // Map 1 owns 灭世 only: no matter which index reports in, it is final from there.
        expect(bossPhaseIsFinal(1, 0)).toBe(true);
        expect(bossPhaseIsFinal(1, 1)).toBe(true);
    });
});
describe('when the ending may run', () => {
    it('only the last map closes the story', () => {
        // 主人 2026-11-12：`现在打完灭世 Claude 直接进结算了`。前三关只是清关。
        expect(bossSettlementDue(1)).toBe(false);
        expect(bossSettlementDue(2)).toBe(false);
        expect(bossSettlementDue(3)).toBe(false);
        expect(bossSettlementDue(4)).toBe(true);
    });

    it('keeps the old behaviour for a boss level with no phase', () => {
        expect(bossSettlementDue(undefined)).toBe(true);
    });
});
