/**
 * src/lib/characters/skill-summary.ts
 * --------------------------------------------------------------------------
 * One plain sentence per skill, for the tavern's character card.
 *
 * The owner: `将技能介绍在选人界面给写上，每个人物技能有什么效果`.
 *
 * The sentence is DERIVED from the skill spec, never hand-written: every number
 * in it (cooldown, SP cost, multiplier, shield size) is read from the YAML the
 * game actually runs, so retuning a skill retunes its description too. That is
 * the only way a card like this stays honest over months of balance passes.
 */

import type { CharacterSkillSpec } from './types';

export interface SkillSummary {
    /** Name in the character's own language slot (`nameZh` for the zh card). */
    nameZh: string;
    name: string;
    /** One sentence, zh. */
    textZh: string;
    /** One sentence, en. */
    text: string;
}

/** `20` -> `20`, `1.5` -> `1.5`; keeps the sentence free of trailing zeros. */
function trim(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function seconds(ms: number): string {
    return trim(ms / 1000);
}

export function skillSummary(skill: CharacterSkillSpec | undefined): SkillSummary | null {
    if (!skill) return null;

    switch (skill.kind) {
        case 'darkening': {
            const buff = seconds(skill.buffMs);
            const cd = seconds(skill.cooldownMs);
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `开启后 ${buff} 秒内攻击伤害 ×${trim(skill.damageMul)}；冷却 ${cd} 秒，消耗 ${skill.spCost} SP`,
                text: `For ${buff}s your attacks deal ${trim(skill.damageMul)}× damage. ${cd}s cooldown, ${skill.spCost} SP.`,
            };
        }
        case 'critical-next': {
            const cd = seconds(skill.cooldownMs);
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `下一击伤害 ×${trim(skill.damageMul)}，开火即消耗（打空也算）；冷却 ${cd} 秒，消耗 ${skill.spCost} SP`,
                text: `Your next shot deals ${trim(skill.damageMul)}× damage; fired means spent, hit or miss. ${cd}s cooldown, ${skill.spCost} SP.`,
            };
        }
        case 'nine-lives': {
            const cd = seconds(skill.cooldownMs);
            const per = skill.hpPerLevel;
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `展开 ${per}×护甲等级 点生命护盾（0 级 ${per}，满级 ${per * 6}）；先过护甲再吃伤害，碎盾才进冷却；冷却 ${cd} 秒，消耗 ${skill.spCost} SP`,
                text: `A shield worth ${per} per armour level (${per} at 0, ${per * 6} maxed). Armour still applies; the cooldown starts only when it breaks. ${cd}s cooldown, ${skill.spCost} SP.`,
            };
        }
        case 'dragon-roar': {
            const cd = seconds(skill.cooldownMs);
            const hp = Math.round(skill.hpFraction * 100);
            const flat = typeof skill.spCost === 'number' ? skill.spCost : null;
            const fraction = Math.round((skill.spCostFraction ?? 0) * 100);
            const boss = Math.round(hp / 2);
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `视野内每只怪物立刻失去 ${hp}% 最大生命，boss 只失去 ${boss}%（低于这条线的直接死）；消耗 ${flat ?? `${fraction}% 蓝量`} SP；冷却 ${cd} 秒`,
                text: `Every monster on screen instantly loses ${hp}% of its MAX HP, a boss ${boss}% (anything already below dies). ${flat === null ? `Costs ${fraction}% of the SP bar` : `Costs ${flat} SP`}, ${cd}s cooldown.`,
            };
        }
        case 'divine-guest': {
            const buff = seconds(skill.buffMs);
            const cd = seconds(skill.cooldownMs);
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `下一次受伤不扣血（${skill.shieldHits} 次），随后 ${buff} 秒攻击伤害 ×${trim(skill.damageMul)}；冷却 ${cd} 秒，消耗 ${skill.spCost} SP`,
                text: `The next ${skill.shieldHits} hit(s) cost no HP, then ${buff}s of ${trim(skill.damageMul)}× attack damage. ${cd}s cooldown, ${skill.spCost} SP.`,
            };
        }
        case 'headgear':
            return {
                nameZh: skill.nameZh,
                name: skill.name,
                textZh: `挡下 ${skill.absorbHits} 次伤害；冷却 ${seconds(skill.cooldownMs)} 秒，消耗 ${skill.spCost} SP`,
                text: `Absorbs ${skill.absorbHits} hits. ${seconds(skill.cooldownMs)}s cooldown, ${skill.spCost} SP.`,
            };
        default:
            return null;
    }
}
