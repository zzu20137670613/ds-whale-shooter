/**
 * tests/lib/characters/nine-lives.test.ts
 * --------------------------------------------------------------------------
 * Gemini's 九命猫: a shield counted in HP instead of in hits.
 *
 * The numbers the owner set are the spec: 15 at level 0, +15 per level, 90 at level 5,
 * and damage reaches the shield only after armour has taken its cut.
 */

import { describe, expect, it } from 'vitest';

import type { CharacterSkillSpec } from '@/lib/characters/types';
import {
    absorbIncomingHit,
    canUseSkill,
    emptySkillRuntime,
    skillBadgeTone,
    useSkill,
} from '@/lib/characters/skill';
import { damageAfterArmor } from '@/lib/characters/combat';

const SKILL = {
    kind: 'nine-lives',
    name: 'Nine Lives',
    nameZh: '九命猫',
    hpPerLevel: 15,
    cooldownMs: 30_000,
    spCost: 15,
    tintColor: 0xc9a8ff,
} as unknown as CharacterSkillSpec;

/** Raise the shield at a given upgrade level, at t = 0. */
function raise(level: number, sp = 100) {
    const result = useSkill(SKILL, emptySkillRuntime(), 0, sp, 200, undefined, level);
    expect(result.used).toBe(true);
    return result.runtime;
}

describe('the shield ladder', () => {
    it('grants 15 at level 0 and 90 at level 5', () => {
        expect(raise(0).shieldHp).toBe(15);
        expect(raise(1).shieldHp).toBe(30);
        expect(raise(2).shieldHp).toBe(45);
        expect(raise(3).shieldHp).toBe(60);
        expect(raise(4).shieldHp).toBe(75);
        expect(raise(5).shieldHp).toBe(90);
    });

    it('charges the SP price', () => {
        const result = useSkill(SKILL, emptySkillRuntime(), 0, 100, 200);
        expect(result.used).toBe(true);
        expect(result.spCost).toBe(15);
    });

    it('refuses to re-raise a shield that is still standing', () => {
        const up = raise(0);
        expect(canUseSkill(SKILL, up, 100, 200, 200)).toBe(false);
        // Even with the cooldown long expired, worn means worn.
        expect(useSkill(SKILL, up, 999_999, 200, 200).used).toBe(false);
    });

    it('shows a grey badge while the shield is up', () => {
        expect(skillBadgeTone({ readyInMs: 0, sp: 200, spCost: 15, wornShield: 15 })).toBe(
            'cooling',
        );
        expect(skillBadgeTone({ readyInMs: 0, sp: 200, spCost: 15, wornShield: 0 })).toBe('ready');
    });
});

describe('soaking damage', () => {
    it('eats a hit smaller than the shield and keeps the rest', () => {
        const routed = absorbIncomingHit(SKILL, raise(0), 0, 5);
        expect(routed.remainingDamage).toBe(0);
        expect(routed.runtime.shieldHp).toBe(10);
        expect(routed.brokeShield).toBe(false);
    });

    it('lets the overflow through when a big hit breaks it', () => {
        // 15 HP of shield against a 40 damage hit: 25 must reach HP.
        const routed = absorbIncomingHit(SKILL, raise(0), 0, 40);
        expect(routed.remainingDamage).toBe(25);
        expect(routed.runtime.shieldHp).toBe(0);
        expect(routed.brokeShield).toBe(true);
    });

    it('starts the cooldown on the hit that breaks it, not on the press', () => {
        const up = raise(0);
        expect(up.readyAt).toBe(0);
        const routed = absorbIncomingHit(SKILL, up, 5_000, 15);
        expect(routed.runtime.shieldHp).toBe(0);
        expect(routed.runtime.readyAt).toBe(35_000);
    });

    it('absorbs exactly the shield and nothing more', () => {
        const routed = absorbIncomingHit(SKILL, raise(0), 0, 15);
        expect(routed.remainingDamage).toBe(0);
        expect(routed.brokeShield).toBe(true);
    });

    it('is inert with no shield up', () => {
        const routed = absorbIncomingHit(SKILL, emptySkillRuntime(), 0, 30);
        expect(routed.remainingDamage).toBe(30);
        expect(routed.absorbed).toBe(false);
    });
});

describe('armour comes first', () => {
    it('shrinks the hit before the cat sees it', () => {
        // A 100 damage hit against 25 armour is 75, and a 90 shield survives it.
        const afterArmour = damageAfterArmor(100, 25);
        const routed = absorbIncomingHit(SKILL, raise(5), 0, afterArmour);
        expect(afterArmour).toBe(75);
        expect(routed.runtime.shieldHp).toBe(15);
        expect(routed.remainingDamage).toBe(0);
    });

    it('a 120 hit at max armour still gets through a fresh shield', () => {
        // 120 - 25 = 95 arriving; a 15 HP level-0 shield leaves 80.
        const routed = absorbIncomingHit(SKILL, raise(0), 0, damageAfterArmor(120, 25));
        expect(routed.remainingDamage).toBe(80);
    });
});