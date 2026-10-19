/**
 * tests/lib/characters/skill.test.ts
 * --------------------------------------------------------------------------
 * The character skill state machine, pure and scene-free.
 *
 * Five kinds share one runtime: `headgear` (Seed's existing one), `darkening`
 * (timed damage buff), `critical-next` (one-shot buff spent by the next
 * attack, hit or miss), `divine-guest` (one free hit + a timed buff) and
 * `dragon-roar` (a cost + cooldown; the monsters take the hit elsewhere).
 *
 * The headgear is the odd one out on purpose: its cooldown starts when it
 * BREAKS, not when it is worn. Every other kind starts its cooldown on use.
 */

import { describe, expect, it } from 'vitest';

import {
    absorbIncomingHit,
    attackMultiplier,
    canUseSkill,
    emptySkillRuntime,
    skillSpCost,
    useSkill,
} from '@/lib/characters/skill';
import type { CharacterSkillSpec } from '@/lib/characters/types';

const HEADGEAR: CharacterSkillSpec = {
    kind: 'headgear',
    absorbHits: 2,
    cooldownMs: 30000,
    tintColor: 0xffe9a8,
};
const DARKENING: CharacterSkillSpec = {
    kind: 'darkening',
    spCost: 40,
    cooldownMs: 60000,
    buffMs: 20000,
    damageMul: 2,
};
const CRIT: CharacterSkillSpec = {
    kind: 'critical-next',
    spCost: 25,
    cooldownMs: 30000,
    damageMul: 2,
};
const DIVINE: CharacterSkillSpec = {
    kind: 'divine-guest',
    spCost: 30,
    cooldownMs: 45000,
    buffMs: 20000,
    damageMul: 1.5,
    shieldHits: 1,
};
const ROAR: CharacterSkillSpec = {
    kind: 'dragon-roar',
    spCostFraction: 0.8,
    cooldownMs: 60000,
    hpFraction: 0.5,
};

describe('emptySkillRuntime', () => {
    it('starts neutral: nothing worn, nothing buffed, multiplier 1', () => {
        const runtime = emptySkillRuntime();
        expect(runtime.hitsLeft).toBe(0);
        expect(runtime.shieldLeft).toBe(0);
        expect(runtime.nextMul).toBe(1);
        expect(runtime.buffMul).toBe(1);
        expect(runtime.readyAt).toBe(0);
        expect(runtime.buffUntil).toBe(0);
    });
});

describe('skillSpCost', () => {
    it('reads an absolute cost straight off the skill', () => {
        expect(skillSpCost(DARKENING, 75)).toBe(40);
    });

    it('resolves a fraction against the character SP cap', () => {
        expect(skillSpCost(ROAR, 75)).toBe(60);
        expect(skillSpCost(ROAR, 80)).toBe(64);
    });

    it('is free for the headgear', () => {
        expect(skillSpCost(HEADGEAR, 75)).toBe(0);
    });
});

describe('canUseSkill', () => {
    it('allows a use off cooldown with enough SP', () => {
        expect(canUseSkill(DARKENING, emptySkillRuntime(), 0, 75, 75)).toBe(true);
    });

    it('refuses while on cooldown', () => {
        const used = useSkill(DARKENING, emptySkillRuntime(), 0, 75, 75).runtime;
        expect(canUseSkill(DARKENING, used, 1000, 75, 75)).toBe(false);
        expect(canUseSkill(DARKENING, used, 60000, 75, 75)).toBe(true);
    });

    it('refuses when the character cannot pay', () => {
        expect(canUseSkill(DARKENING, emptySkillRuntime(), 0, 39, 75)).toBe(false);
        expect(canUseSkill(DARKENING, emptySkillRuntime(), 0, 40, 75)).toBe(true);
    });

    it('refuses to re-wear a headgear that is already on', () => {
        const worn = useSkill(HEADGEAR, emptySkillRuntime(), 0, 75, 75).runtime;
        expect(worn.hitsLeft).toBe(2);
        expect(canUseSkill(HEADGEAR, worn, 1000, 75, 75)).toBe(false);
    });
});

describe('useSkill', () => {
    it('arms the buff and starts the cooldown on use', () => {
        const { runtime, used, spCost } = useSkill(DARKENING, emptySkillRuntime(), 1000, 75, 75);
        expect(used).toBe(true);
        expect(spCost).toBe(40);
        expect(runtime.buffUntil).toBe(21000);
        expect(runtime.buffMul).toBe(2);
        expect(runtime.readyAt).toBe(61000);
    });

    it('does nothing and costs nothing when it cannot fire', () => {
        const before = emptySkillRuntime();
        const poor = useSkill(DARKENING, before, 0, 10, 75);
        expect(poor.used).toBe(false);
        expect(poor.spCost).toBe(0);
        expect(poor.runtime).toEqual(before);
    });

    it('arms a one-shot crit without touching the timed buff', () => {
        const { runtime } = useSkill(CRIT, emptySkillRuntime(), 500, 75, 75);
        expect(runtime.nextMul).toBe(2);
        expect(runtime.buffMul).toBe(1);
        expect(runtime.readyAt).toBe(30500);
    });

    it('gives the divine guest a shield and a buff at once', () => {
        const { runtime } = useSkill(DIVINE, emptySkillRuntime(), 0, 75, 75);
        expect(runtime.shieldLeft).toBe(1);
        expect(runtime.buffMul).toBe(1.5);
        expect(runtime.buffUntil).toBe(20000);
        expect(runtime.readyAt).toBe(45000);
    });

    it('wears the headgear without starting the cooldown yet', () => {
        const { runtime } = useSkill(HEADGEAR, emptySkillRuntime(), 100, 75, 75);
        expect(runtime.hitsLeft).toBe(2);
        expect(runtime.readyAt).toBe(0);
    });
});

describe('attackMultiplier', () => {
    it('is 1 with no skill running', () => {
        expect(attackMultiplier(emptySkillRuntime(), 0)).toEqual({
            mul: 1,
            runtime: emptySkillRuntime(),
        });
    });

    it('stays doubled for the whole buff window, then lapses', () => {
        const buffed = useSkill(DARKENING, emptySkillRuntime(), 0, 75, 75).runtime;
        expect(attackMultiplier(buffed, 19000).mul).toBe(2);
        expect(attackMultiplier(buffed, 20000).mul).toBe(1);
    });

    it('spends a crit on exactly one attack', () => {
        const armed = useSkill(CRIT, emptySkillRuntime(), 0, 75, 75).runtime;
        const first = attackMultiplier(armed, 100);
        expect(first.mul).toBe(2);
        expect(first.runtime.nextMul).toBe(1);
        expect(attackMultiplier(first.runtime, 200).mul).toBe(1);
    });

    it('composes a crit on top of a timed buff', () => {
        const both = { ...useSkill(DARKENING, emptySkillRuntime(), 0, 75, 75).runtime, nextMul: 2 };
        expect(attackMultiplier(both, 1000).mul).toBe(4);
    });
});

describe('absorbIncomingHit', () => {
    it('soaks up hits and only starts the cooldown when it breaks', () => {
        const worn = useSkill(HEADGEAR, emptySkillRuntime(), 0, 75, 75).runtime;
        const first = absorbIncomingHit(HEADGEAR, worn, 500);
        expect(first.absorbed).toBe(true);
        expect(first.brokeHeadgear).toBe(false);
        expect(first.runtime.hitsLeft).toBe(1);
        expect(first.runtime.readyAt).toBe(0);

        const second = absorbIncomingHit(HEADGEAR, first.runtime, 1000);
        expect(second.absorbed).toBe(true);
        expect(second.brokeHeadgear).toBe(true);
        expect(second.runtime.hitsLeft).toBe(0);
        expect(second.runtime.readyAt).toBe(31000);
    });

    it('lets hits through once the headgear is broken', () => {
        const broken = { ...emptySkillRuntime(), readyAt: 31000 };
        const hit = absorbIncomingHit(HEADGEAR, broken, 2000);
        expect(hit.absorbed).toBe(false);
        expect(hit.brokeHeadgear).toBe(false);
    });

    it('gives the divine guest exactly one free hit', () => {
        const shielded = useSkill(DIVINE, emptySkillRuntime(), 0, 75, 75).runtime;
        const first = absorbIncomingHit(DIVINE, shielded, 100);
        expect(first.absorbed).toBe(true);
        expect(first.runtime.shieldLeft).toBe(0);
        expect(first.brokeHeadgear).toBe(false);
        expect(absorbIncomingHit(DIVINE, first.runtime, 200).absorbed).toBe(false);
    });

    it('never absorbs while no skill is worn', () => {
        expect(absorbIncomingHit(undefined, emptySkillRuntime(), 0).absorbed).toBe(false);
    });
});
