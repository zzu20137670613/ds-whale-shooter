/**
 * src/lib/drops/effect-text.ts
 * --------------------------------------------------------------------------
 * 一句话说清一个道具干了什么 —— 背包「图鉴」弹框里每行右边那半句。
 *
 * 主人 2026-11-15：`在背包底部的数量 XXXX/XXXX 后面添加一个【图鉴】按钮，
 * 悬停或者点击都出一个弹框……写各项道具的介绍，简单样式即可，每一行的样式 道具：效果`。
 *
 * 文案从 `effect` 现算，不写死在 YAML 里：数值改了（`将过载核心的数值改为补血60+补蓝30`）
 * 图鉴要跟着变，否则就是两份真相。
 */

import { TOKEN_SHIELD_MAX_LEVEL } from '@/lib/drops/token-shield';

/**
 * 这件道具的拾取台词该不该在**这一关**弹。
 *
 * 两层绑定（主人 2026-11-17）：道具自己有台词，且（如果它声明了关卡白名单）当前关卡在名单里。
 * 深海特饮既摆在礁石上当彩蛋，也会从怪身上掉；"礁石上有杯……"只能在海滩说。
 */
export function pickupNoticeApplies(
    spec: { pickupNotice?: string; pickupNoticeZh?: string; pickupNoticeLevels?: readonly string[] },
    levelId: string | undefined,
): boolean {
    if (!spec.pickupNotice && !spec.pickupNoticeZh) return false;
    const levels = spec.pickupNoticeLevels;
    if (!levels || levels.length === 0) return true;
    return levelId !== undefined && levels.includes(levelId);
}

import type { DropEffect } from './types';

export interface EffectText {
    zh: string;
    en: string;
}

/** 数值 → 中英两行。 */
export function describeEffect(effect: DropEffect, descriptionZh?: string, description?: string): EffectText {
    switch (effect.type) {
        case 'instant': {
            const parts: string[] = [];
            const partsEn: string[] = [];
            if (effect.hp > 0) {
                parts.push(`补血 ${effect.hp}`);
                partsEn.push(`+${effect.hp} HP`);
            }
            if (effect.sp > 0) {
                parts.push(`补蓝 ${effect.sp}`);
                partsEn.push(`+${effect.sp} SP`);
            }
            return { zh: parts.join(' + '), en: partsEn.join(' + ') };
        }
        case 'refill-ammo': {
            const percent = Math.round(effect.ammoFraction * 100);
            return { zh: `弹药补 ${percent}%`, en: `refill ${percent}% ammo` };
        }
        case 'full-restore':
            return { zh: '补满血与蓝', en: 'restore HP and SP fully' };
        case 'token-shield':
            // 上限读常量，别写死：盾从 5 级扩到 10 级那次，图鉴里还挂着「最多 5 级」。
            return {
                zh: `词元盾 +1 级（最多 ${TOKEN_SHIELD_MAX_LEVEL} 级）`,
                en: `token shield +1 level (max ${TOKEN_SHIELD_MAX_LEVEL})`,
            };
        case 'weapon':
            return { zh: '换成这把武器', en: 'swap to this weapon' };
        case 'max-bonus': {
            // 主人 2026-11-17：加冕之冠 = +100 血上限 +100 蓝上限，带在背包里就生效。
            const bits: string[] = [];
            const bitsEn: string[] = [];
            if (effect.hp > 0) {
                bits.push(`血上限 +${effect.hp}`);
                bitsEn.push(`+${effect.hp} max HP`);
            }
            if (effect.sp > 0) {
                bits.push(`蓝上限 +${effect.sp}`);
                bitsEn.push(`+${effect.sp} max SP`);
            }
            if (bits.length === 0) return { zh: '带在身上生效', en: 'works while carried' };
            return { zh: `${bits.join('、')}（带着就生效）`, en: `${bitsEn.join(', ')} (while carried)` };
        }
        case 'material':
            // 关键道具自带说明（饭盆：敬请期待（未至之境关键道具）），没有就说它是材料。
            if (descriptionZh) return { zh: descriptionZh, en: description || descriptionZh };
            return { zh: '材料 · 可出售', en: 'material · sellable' };
        default:
            return { zh: '', en: '' };
    }
}