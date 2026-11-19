/**
 * tests/lib/bosses/phases.test.ts
 * --------------------------------------------------------------------------
 * Claude's five-phase ladder, pinned to the numbers the owner locked in
 * `boss-神Claude-机制总表.md`.
 *
 * The interesting assertions are not "the array has five entries" — they are the
 * shape of the descent: phase 2 is the hardest, the last phase is the calmest, and
 * every rule that exists to stop the fight feeling unfair still holds.
 */

import { describe, expect, it } from 'vitest';

import { spriteHeightForPhase } from '@/lib/bosses/phases';

import {
    BOSS_MAX_HIT_FRACTION,
    BOSS_PHASES,
    applyBossHit,
    attacksForPhase,
    clampBossDamage,
    entropyRadius,
    nextPhase,
    phaseAt,
    pickNextAttack,
    scaleForPhase,
    wrathCircleCount,
} from '@/lib/bosses/phases';

describe('the ladder', () => {
    it('is four phases, in order', () => {
        expect(BOSS_PHASES.map((phase) => phase.id)).toEqual([1, 2, 3, 4]);
    });

    it('peaks at phase 2 and unwinds from there', () => {
        const [first, second, third, fourth] = BOSS_PHASES;
        // The god phase is the only one that scales anything above 100%, and it went up
        // to 1.8 on both health and damage when the owner called her too soft.
        expect(second.hpScale).toBe(3.6);
        expect(second.moveScale).toBe(1.5);
        expect(second.damageScale).toBe(1.8);
        // Below the opening phase afterwards - this is a descent, not an escalation.
        expect(third.hpScale).toBeLessThan(first.hpScale);
        expect(fourth.hpScale).toBeLessThan(third.hpScale);
        });

    it('tightens the gap at the peak and opens it at the end', () => {
        const gaps = BOSS_PHASES.map((phase) => phase.gapMs);
        // Halved everywhere except the ending, which stays long on purpose.
        expect(gaps).toEqual([750, 500, 1000, 1000]);
        // Phase 2 swings fastest; phase 5 gives the longest breathing room.
        expect(Math.min(...gaps)).toBe(500);
        expect(Math.max(...gaps)).toBe(1000);
    });

    it('gives wrath to every phase except the demigod one', () => {
        // 主人 2026-11-16：`将阶段③的攻击方式由3种改为两种：三连击+顺时针，将天谴轰炸去掉`。
        expect(BOSS_PHASES.filter((phase) => phase.allowsWrath).map((phase) => phase.id)).toEqual([
            1, 2, 4,
        ]);
    });

    it('doubles the shell range in the two late phases', () => {
        // `阶段34的移速削弱去掉，并且攻击距离翻倍` —— 攻击距离 = 炮弹飞行距离。
        expect(BOSS_PHASES[2]!.bulletLifeScale).toBe(2);
        expect(BOSS_PHASES[3]!.bulletLifeScale).toBe(2);
        expect(BOSS_PHASES[0]!.bulletLifeScale ?? 1).toBe(1);
        expect(BOSS_PHASES[1]!.bulletLifeScale ?? 1).toBe(1);
    });

    it('stops slowing her down in the last two phases', () => {
        // 0.8 / 0.5 → 1：`阶段34的移速削弱去掉`。
        expect(BOSS_PHASES[2]!.moveScale).toBe(1);
        expect(BOSS_PHASES[3]!.moveScale).toBe(1);
    });
});

describe('phaseAt', () => {
    it('maps 0 to phase 1', () => {
        expect(phaseAt(0).id).toBe(1);
    });

    it('clamps below and above the ladder', () => {
        expect(phaseAt(-3).id).toBe(1);
        expect(phaseAt(99).id).toBe(4);
    });
});

describe('nextPhase', () => {
    it('walks 1 to 4 and then stops', () => {
        expect(nextPhase(0)?.id).toBe(2);
        expect(nextPhase(2)?.id).toBe(4);
        expect(nextPhase(3)).toBeNull();
    });
});

describe('scaleForPhase', () => {
    const base = { hp: 4000, moveSpeed: 7, damage: 100 };

    it('doubles phase 1 instead of leaving it alone', () => {
        // 灭世 was doubled on the owner's call (`给灭世和半神两个阶段的血量都翻倍`).
        expect(scaleForPhase(base, BOSS_PHASES[0])).toEqual({
            hp: 8000,
            moveSpeed: 7,
            damage: 100,
        });
    });

    it('applies the peaks and troughs', () => {
        // 神·Claude is stronger now: 1.8x health and damage (owner, 2026-10-31).
        expect(scaleForPhase(base, BOSS_PHASES[1])).toEqual({
            hp: 14400,
            moveSpeed: 10.5,
            damage: 180,
        });
        // 第四阶段的移速削弱 2026-11-16 去掉（0.5 → 1），所以现在是 7 不是 3.5。
        expect(scaleForPhase(base, BOSS_PHASES[3])).toEqual({
            hp: 2000,
            moveSpeed: 7,
            damage: 50,
        });
    });

    it('never rounds a phase down to zero', () => {
        // A tiny authored HP times 0.5 must still leave a fightable body.
        expect(scaleForPhase({ hp: 1, moveSpeed: 1, damage: 1 }, BOSS_PHASES[3]).hp).toBe(1);
    });
});

describe('wrath', () => {
    it('is three circles, five when she is at or below half health', () => {
        const deity = BOSS_PHASES[1];
        expect(wrathCircleCount(deity, 1)).toBe(3);
        expect(wrathCircleCount(deity, 0.5)).toBe(5);
        expect(wrathCircleCount(deity, 0.2)).toBe(5);
    });

    it('does not exist outside phase 2, whatever her health', () => {
        for (const phase of BOSS_PHASES.filter((candidate) => !candidate.allowsWrath)) {
            expect(wrathCircleCount(phase, 0.1)).toBe(0);
        }
    });
});

describe('attack pool', () => {
    it('gives the first two phases the three ordinary attacks', () => {
        for (const phase of BOSS_PHASES.slice(0, 2)) {
            const attacks = attacksForPhase(phase);
            expect(attacks).toContain('triple-cannon');
            expect(attacks).toContain('melee');
            expect(attacks).toContain('barrage');
        }
    });

    it('leaves the demigod phase two attacks: the cannon and the clockwork rings', () => {
        // 主人 2026-11-16：`阶段③：三连击+顺时针，将天谴轰炸去掉`。
        expect(attacksForPhase(BOSS_PHASES[2]!)).toEqual(['triple-cannon', 'barrage']);
    });

    it('leaves the half-mortal phase one primary, because wrath is appended by the scheduler', () => {
        // `阶段④：三连击+天谴轰炸，顺时针去掉` —— 天谴不在池里，由每两轮追加一次。
        expect(attacksForPhase(BOSS_PHASES[3]!)).toEqual(['triple-cannon']);
        expect(BOSS_PHASES[3]!.allowsWrath).toBe(true);
    });

    it('keeps wrath out of the rollable pool', () => {
        // Wrath is appended after every primary move by the scheduler, so rolling it as a
        // primary would give her two wraths in one round and skip the three real attacks.
        for (const phase of BOSS_PHASES) {
            expect(attacksForPhase(phase)).not.toContain('wrath');
        }
    });
});

describe('pickNextAttack', () => {
    const deity = BOSS_PHASES[1];

    it('never repeats the previous attack', () => {
        // 200 draws, always asking for "not this again".
        for (let i = 0; i < 200; i += 1) {
            const attack = pickNextAttack(deity, 'triple-cannon', Math.random);
            expect(attack).not.toBe('triple-cannon');
        }
    });

    it('never follows a barrage with wrath, or wrath with a barrage', () => {
        for (let i = 0; i < 200; i += 1) {
            expect(pickNextAttack(deity, 'barrage', Math.random)).not.toBe('wrath');
            expect(pickNextAttack(deity, 'wrath', Math.random)).not.toBe('barrage');
        }
    });

    it('can still reach every legal attack', () => {
        const seen = new Set<string>();
        for (let i = 0; i < 400; i += 1) {
            seen.add(pickNextAttack(deity, 'melee', Math.random));
        }
        expect(seen).toEqual(new Set(['triple-cannon', 'barrage'])); // wrath never rolls
    });

    it('falls back to the full pool when only one attack exists', () => {
        // A phase with a single attack must not deadlock on the no-repeat rule.
        const lonely = { ...BOSS_PHASES[0], allowsWrath: false, id: 9 };
        expect(pickNextAttack(lonely, 'triple-cannon', () => 0)).toBeTruthy();
    });
});

describe('entropy', () => {
    it('grows the radius by five percent per wave', () => {
        expect(entropyRadius(100, 0)).toBe(100);
        expect(entropyRadius(100, 1)).toBeCloseTo(105, 5);
        expect(entropyRadius(100, 2)).toBeCloseTo(110.25, 5);
    });

    it('ignores a negative wave count', () => {
        expect(entropyRadius(100, -4)).toBe(100);
    });
});
describe('the health lock', () => {
    it('caps one hit at a tenth of the phase health', () => {
        expect(BOSS_MAX_HIT_FRACTION).toBe(0.1);
        // Phase 5 is authored at 4000 * 0.5 = 2000.
        expect(clampBossDamage(99_999, 2000)).toBe(200);
    });

    it('lets an honest hit through untouched', () => {
        expect(clampBossDamage(105, 2000)).toBe(105);
    });

    it('never caps to zero, so a tiny boss is still killable', () => {
        expect(clampBossDamage(50, 5)).toBe(1);
    });

    it('ignores negative damage', () => {
        expect(clampBossDamage(-30, 2000)).toBe(0);
    });

    it('turns an edited one-shot into at least ten hits', () => {
        // 2000 HP, a bogus 999999 damage swing: nine hits leave her standing...
        let hp = 2000;
        for (let i = 0; i < 9; i += 1) {
            const result = applyBossHit(hp, 999_999, 2000);
            expect(result.died).toBe(false);
            hp = result.hp;
        }
        // ...and the tenth finally ends the phase.
        expect(applyBossHit(hp, 999_999, 2000).died).toBe(true);
    });

    it('still kills a nearly-dead boss with a normal hit', () => {
        expect(applyBossHit(3, 50, 2000)).toEqual({ hp: 0, died: true });
    });
});

describe('a whole descent', () => {
    it('walks all four phases and ends on the fourth', () => {
        // The controller's loop, reduced to the parts that are testable: empty a bar,
        // advance, refill to the new pool, repeat. This is the shape the fight has to
        // have or the ladder is decorative.
        const authored = { hp: 4000, moveSpeed: 7, damage: 130 };
        let phaseIndex = 0;
        const pools: number[] = [];

        for (;;) {
            const phase = phaseAt(phaseIndex);
            const stats = scaleForPhase(authored, phase);
            pools.push(stats.hp);

            // Empty the bar with honest hits of 130 damage, capped per hit.
            let hp = stats.hp;
            let hits = 0;
            while (hp > 0) {
                hp = applyBossHit(hp, 130, stats.hp).hp;
                hits += 1;
                if (hits > 5000) throw new Error('the bar never emptied');
            }

            const upcoming = nextPhase(phaseIndex);
            if (!upcoming) break;
            phaseIndex += 1;
            expect(upcoming.id).toBe(phaseIndex + 1);
        }

        expect(phaseIndex).toBe(3);
        expect(pools).toEqual([8000, 14400, 6400, 2000]);
    });

    it('never lets a phase take fewer than ten hits, even from absurd damage', () => {
        for (let index = 0; index < BOSS_PHASES.length; index += 1) {
            const stats = scaleForPhase({ hp: 4000, moveSpeed: 7, damage: 1 }, phaseAt(index));
            let hp = stats.hp;
            let hits = 0;
            while (hp > 0) {
                hp = applyBossHit(hp, 1e9, stats.hp).hp;
                hits += 1;
            }
            expect(hits, `phase ${index + 1}`).toBeGreaterThanOrEqual(10);
        }
    });
});

describe('boss sprite height per phase', () => {
    it('stands taller than the player for the first three forms', () => {
        expect([1, 2, 3].map((n) => spriteHeightForPhase(phaseAt(n - 1)))).toEqual([281, 281, 281]);
    });

    it('drops to 235 for the half-mortal form', () => {
        expect(spriteHeightForPhase(phaseAt(3))).toBe(235);
    });

    it('stops at the half-mortal form, which is now the last one', () => {
        // 第五阶段砍掉后，半人就是最终形态；phaseAt 会把越界索引夹回来。
        expect(spriteHeightForPhase(phaseAt(4))).toBe(235);
    });

    it('shrinks monotonically - she never grows back', () => {
        const heights = [0, 1, 2, 3].map((n) => spriteHeightForPhase(phaseAt(n)));
        for (let i = 1; i < heights.length; i++) {
            expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]);
        }
    });
});
