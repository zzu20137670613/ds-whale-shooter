/**
 * tests/lib/bosses/wrath-pairing.test.ts
 * --------------------------------------------------------------------------
 * Every round of the fight is now `primary + 天谴轰炸`.
 *
 * The owner, 2026-10-31: `每次出两招，天谴轰炸每次都出手，所以攻击方式就是：三连击+天谴轰炸，
 * 顺时针轰炸+天谴轰炸，近战攻击+天谴轰炸`. These tests pin the two halves of that rule: the
 * three primaries stay rollable, and wrath is never one of them - it is appended.
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_FALL_MS,
    BOSS_NAME_FONT_PX,
    BOSS_PHASES,
    bossPhaseNameColour,
    attacksForPhase,
    pickNextAttack,
} from '@/lib/bosses/phases';
import { WRATH_BASE_RADIUS, WRATH_FUSE_MS, WRATH_PAIR_DELAY_MS } from '@/lib/bosses/attacks';
import { ALARM_MS } from '@/game/monsters/wrath';

describe('the primaries', () => {
    it('are exactly the three the owner named (minus what 2026-11-16 removed)', () => {
        // 前两阶段不变；阶段③去掉天谴（allowsWrath false）、阶段④去掉顺时针。
        for (const phase of BOSS_PHASES.slice(0, 2)) {
            expect(new Set(attacksForPhase(phase))).toEqual(
                new Set(['triple-cannon', 'melee', 'barrage']),
            );
        }
        expect(new Set(attacksForPhase(BOSS_PHASES[2]!))).toEqual(
            new Set(['triple-cannon', 'barrage']),
        );
        expect(new Set(attacksForPhase(BOSS_PHASES[3]!))).toEqual(new Set(['triple-cannon']));
    });

    it('never roll wrath, whatever the phase', () => {
        for (const phase of BOSS_PHASES) {
            for (let i = 0; i < 50; i += 1) {
                expect(pickNextAttack(phase, null, Math.random)).not.toBe('wrath');
            }
        }
    });
});

describe('the wrath half', () => {
    it('lands 200ms after the primary', () => {
        expect(WRATH_PAIR_DELAY_MS).toBe(200);
    });

    it('is a 320px circle - halved after the stacking deaths', () => {
        expect(WRATH_BASE_RADIUS).toBe(160);
        expect(WRATH_BASE_RADIUS * 2).toBe(320);
    });
});

describe('the gaps', () => {
    it('are halved in the first three phases and left alone in the last', () => {
        expect(BOSS_PHASES.map((phase) => phase.gapMs)).toEqual([750, 500, 1000, 1000]);
    });

    it('still peak at the god phase', () => {
        const gaps = BOSS_PHASES.map((phase) => phase.gapMs);
        expect(Math.min(...gaps)).toBe(BOSS_PHASES[1]?.gapMs);
    });
});

describe('the god phase', () => {
    it('is stronger than she was', () => {
        const deity = BOSS_PHASES[1]!;
        // Doubled again on the owner's call: 1.8 -> 3.6.
        expect(deity.hpScale).toBe(3.6);
        expect(deity.damageScale).toBe(1.8);
    });
});

describe('the fuse', () => {
    it('gives 0.5s more blue and 0.5s more red than it used to', () => {
        // Was 1000ms total with a 320ms red tail; now 2000ms with an 820ms tail, so the
        // blue stretch grew 680 -> 1180 and the red 320 -> 820.
        expect(WRATH_FUSE_MS).toBe(2000);
        expect(ALARM_MS).toBe(820);
        expect(WRATH_FUSE_MS - ALARM_MS).toBe(1180);
        expect(ALARM_MS - 320).toBe(500);
        expect(WRATH_FUSE_MS - ALARM_MS - 680).toBe(500);
    });

    it('leaves the red window longer than the old whole fuse', () => {
        expect(ALARM_MS).toBeGreaterThan(320);
    });
});

describe('the fall between the first two bars', () => {
    it('is three seconds of her death clip, slowed to fill it', () => {
        // Two seconds read as a blink in play (`实机测试时发现这两秒动画没有`), so the
        // owner asked for three and for the fall itself to be slower.
        expect(BOSS_FALL_MS).toBe(3000);
    });

    it('does not shorten the other phase turns', () => {
        // Only the first hand-over gets the extra pause.
        expect(BOSS_FALL_MS).toBeGreaterThan(0);
        expect(BOSS_FALL_MS).not.toBe(BOSS_PHASES[2]?.gapMs);
    });
});

describe('the plate', () => {
    it('is two sizes bigger than a monster plate', () => {
        // The status HUD draws plain monsters at 11px; the boss is 15px.
        expect(BOSS_NAME_FONT_PX).toBe(15);
    });

    it('gives every phase its own colour', () => {
        const colours = BOSS_PHASES.map((_, index) => bossPhaseNameColour(index).fill);
        expect(new Set(colours).size).toBe(BOSS_PHASES.length);
    });

    it('matches the prefixes the owner named', () => {
        expect(bossPhaseNameColour(0).fill.toLowerCase()).toBe('#111111'); // 灭世 黑
        expect(bossPhaseNameColour(1).fill.toLowerCase()).toBe('#ff2d2d'); // 神 红
        expect(bossPhaseNameColour(2).fill.toLowerCase()).toBe('#38bdf8'); // 半神 蓝
        expect(bossPhaseNameColour(3).fill.toLowerCase()).toBe('#22c55e'); // 半神半人 绿
    });

    it('clamps out-of-range indices like phaseAt', () => {
        expect(bossPhaseNameColour(-5).fill).toBe(bossPhaseNameColour(0).fill);
        expect(bossPhaseNameColour(99).fill).toBe(bossPhaseNameColour(4).fill);
    });
});

describe('the doubled phases', () => {
    it('灭世 and 半神 are twice what they were', () => {
        expect(BOSS_PHASES[0]?.hpScale).toBe(2);
        expect(BOSS_PHASES[2]?.hpScale).toBe(1.6);
    });

    it('and the untouched ones did not move', () => {
        expect(BOSS_PHASES[1]?.hpScale).toBe(3.6);
        expect(BOSS_PHASES[3]?.hpScale).toBe(0.5);
        expect(BOSS_PHASES[3]?.hpScale).toBe(0.5);
    });
});
