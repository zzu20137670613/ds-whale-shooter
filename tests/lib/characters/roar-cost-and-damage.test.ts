/**
 * tests/lib/characters/roar-cost-and-damage.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-14 的定价：`改成初始放一次扣150SP，然后扣血对boss减半（小怪扣一半，boss扣1/4）`。
 *
 * Two rules, and both used to be impossible to express:
 *
 *  1. **A flat price.** The roar was charged as a share of the pool (`spCostFraction: 1`), so it
 *     silently doubled when the pool went 80 -> 180 (commit 48ced15) — nobody touched the skill.
 *     A fixed 150 SP does not move when the SP ladder grows.
 *  2. **A boss takes a quarter, not a half.** The roar is a share of MAX HP; on a boss that share
 *     is halved again, so one roar cannot walk away with half of Claude's first phase bar.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCharacterYaml } from '@/lib/characters/parser';
import { skillSpCost } from '@/lib/characters/skill';
import { isRoarBoss, roarDamage, roarDamageFor } from '@/game/monsters/logic';
import { ROAR_BOSS_DAMAGE_MULTIPLIER } from '@/lib/constants';

const ROOT = process.cwd();

function gpt(): ReturnType<typeof parseCharacterYaml> {
    return parseCharacterYaml(
        readFileSync(join(ROOT, 'public', 'data', 'characters', 'gpt.yaml'), 'utf8'),
        'gpt',
    );
}

describe('the roar is priced at a flat 150 SP', () => {
    it('ships a flat spCost and no fraction', () => {
        const skill = gpt().skill;
        expect(skill?.kind).toBe('dragon-roar');
        expect(skill && 'spCost' in skill ? skill.spCost : undefined).toBe(150);
        expect(
            skill && 'spCostFraction' in skill ? skill.spCostFraction : undefined,
        ).toBeUndefined();
    });

    it('does not grow when the SP pool grows', () => {
        const skill = gpt().skill;
        // Base pool, then a maxed spirit ladder (+10 a level).
        expect(skillSpCost(skill, 180)).toBe(150);
        expect(skillSpCost(skill, 230)).toBe(150);
    });

    it('leaves her enough bar for a second roar after a refill', () => {
        // 180 pool, 150 price: one roar leaves 30, a full bar covers exactly one and a bit.
        expect(180 - skillSpCost(gpt().skill, 180)).toBe(30);
    });
});

describe('the roar takes half of a monster, a quarter of a boss', () => {
    it('halves the MAX HP of an ordinary monster', () => {
        expect(roarDamageFor(400, 0.5, false)).toBe(200);
        expect(roarDamage(400, 0.5)).toBe(200);
    });

    it('takes a quarter of a boss', () => {
        expect(ROAR_BOSS_DAMAGE_MULTIPLIER).toBe(0.5);
        // 0.5 of the authored 0.5 share = 0.25 of the bar.
        expect(roarDamageFor(8000, 0.5, true)).toBe(2000);
    });

    it('counts a 守关守卫 as a boss even though it is not boss: true', () => {
        // 主人 2026-11-14: `我说的boss就是三个守关守卫，gpt遇不到bossClaude的`。
        // Kitty / Bunny / Wanderer carry `bossAttack`, not `boss`.
        expect(isRoarBoss({ bossAttack: 'triple-cannon' })).toBe(true);
        expect(isRoarBoss({ bossAttack: 'barrage' })).toBe(true);
        expect(isRoarBoss({ bossAttack: 'triple-wrath' })).toBe(true);
    });

    it('counts Claude as one too, and a plain monster as none', () => {
        expect(isRoarBoss({ boss: true })).toBe(true);
        expect(isRoarBoss({})).toBe(false);
        expect(isRoarBoss({ boss: false })).toBe(false);
    });

    it('gives a guardian a quarter of its bar', () => {
        // Kitty: 2000 authored HP -> 500, where a plain monster of the same HP would lose 1000.
        expect(roarDamageFor(2000, 0.5, isRoarBoss({ bossAttack: 'triple-cannon' }))).toBe(500);
        expect(roarDamageFor(2000, 0.5, false)).toBe(1000);
    });

    it('never rounds down to nothing', () => {
        expect(roarDamageFor(1, 0.5, true)).toBe(1);
    });
});
