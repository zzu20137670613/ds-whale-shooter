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
    it('is five phases, in order', () => {
        expect(BOSS_PHASES.map((phase) => phase.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('peaks at phase 2 and unwinds from there', () => {
        const [first, second, third, fourth, fifth] = BOSS_PHASES;
        // The god phase is the only one that scales anything above 100%.
        expect(second.hpScale).toBe(1.5);
        expect(second.moveScale).toBe(1.5);
        expect(second.damageScale).toBe(1.5);
        // Below the opening phase afterwards - this is a descent, not an escalation.
        expect(third.hpScale).toBeLessThan(first.hpScale);
        expect(fourth.hpScale).toBeLessThan(third.hpScale);
        expect(fifth.damageScale).toBeLessThanOrEqual(fourth.damageScale);
    });

    it('tightens the gap at the peak and opens it at the end', () => {
        const gaps = BOSS_PHASES.map((phase) => phase.gapMs);
        expect(gaps).toEqual([1500, 1000, 2000, 2000, 5000]);
        // Phase 2 swings fastest; phase 5 gives the longest breathing room.
        expect(Math.min(...gaps)).toBe(1000);
        expect(Math.max(...gaps)).toBe(5000);
    });

    it('gives wrath to the deity phase alone', () => {
        expect(BOSS_PHASES.filter((phase) => phase.allowsWrath).map((phase) => phase.id)).toEqual([2]);
    });
});

describe('phaseAt', () => {
    it('maps 0 to phase 1', () => {
        expect(phaseAt(0).id).toBe(1);
    });

    it('clamps below and above the ladder', () => {
        expect(phaseAt(-3).id).toBe(1);
        expect(phaseAt(99).id).toBe(5);
    });
});

describe('nextPhase', () => {
    it('walks 1 to 5 and then stops', () => {
        expect(nextPhase(0)?.id).toBe(2);
        expect(nextPhase(3)?.id).toBe(5);
        expect(nextPhase(4)).toBeNull();
    });
});

describe('scaleForPhase', () => {
    const base = { hp: 4000, moveSpeed: 7, damage: 100 };

    it('leaves phase 1 untouched', () => {
        expect(scaleForPhase(base, BOSS_PHASES[0])).toEqual({
            hp: 4000,
            moveSpeed: 7,
            damage: 100,
        });
    });

    it('applies the peaks and troughs', () => {
        expect(scaleForPhase(base, BOSS_PHASES[1])).toEqual({
            hp: 6000,
            moveSpeed: 10.5,
            damage: 150,
        });
        expect(scaleForPhase(base, BOSS_PHASES[4])).toEqual({
            hp: 2000,
            moveSpeed: 3.5,
            damage: 50,
        });
    });

    it('never rounds a phase down to zero', () => {
        // A tiny authored HP times 0.5 must still leave a fightable body.
        expect(scaleForPhase({ hp: 1, moveSpeed: 1, damage: 1 }, BOSS_PHASES[4]).hp).toBe(1);
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
    it('gives every phase the three ordinary attacks', () => {
        for (const phase of BOSS_PHASES) {
            const attacks = attacksForPhase(phase);
            expect(attacks).toContain('triple-cannon');
            expect(attacks).toContain('melee');
            expect(attacks).toContain('barrage');
        }
    });

    it('adds wrath only to phase 2', () => {
        expect(attacksForPhase(BOSS_PHASES[1])).toContain('wrath');
        expect(attacksForPhase(BOSS_PHASES[0])).not.toContain('wrath');
        expect(attacksForPhase(BOSS_PHASES[4])).not.toContain('wrath');
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
        expect(seen).toEqual(new Set(['triple-cannon', 'barrage', 'wrath']));
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
    it('walks all five phases and ends on the fifth', () => {
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

        expect(phaseIndex).toBe(4);
        expect(pools).toEqual([4000, 6000, 3200, 2000, 2000]);
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
