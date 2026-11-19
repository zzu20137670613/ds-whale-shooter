/**
 * src/lib/drops/use-check.ts
 * --------------------------------------------------------------------------
 * Would using this item actually do anything?
 *
 * The ammo box taught the rule: an item that is consumed and changes nothing is a bug the
 * player pays for. Ammo had three ways to do that (zero rounds, a melee slot, a level-0 cap).
 * The consumables have the mirror-image version:
 *
 *   - 生命碎片 (hp 25) at full HP heals 0 — the shard is gone.
 *   - 记忆碎片 (sp 30) at full SP restores 0.
 *   - 海风特饮 / 冰镇果汁 (full-restore) at full HP *and* full SP restore nothing.
 *   - 过载核心 (hp 50 / sp 50) likewise when both bars are full.
 *
 * So the bag asks this first and refuses, keeping the item, instead of eating it.
 */

import type { DropEffect } from '@/lib/drops';
import type { DropSpec } from '@/lib/drops/types';

export interface Vitals {
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;
}

/** Whether a ranged weapon is carried at all — the minimum for an ammo box to mean something. */
export interface AmmoSituation {
    hasRangedWeapon: boolean;
}

/**
 * `true` when picking this drop up applies it on the spot instead of posting it to the bag.
 *
 * 词元盾 is the first of these: 主人's rule is `不进背包，拾取自动生效`. Without this the
 * generic "everything else goes in the bag" branch swallowed it - the shield vanished into an
 * inventory slot that has no catalog entry, `addInventoryItem` returned 0, the drop was left
 * lying on the floor, and the level never went up. The owner's report: `捡了词元盾，徽章没有出现`.
 */
export function appliesOnPickup(spec: Pick<DropSpec, 'effect'>): boolean {
    return spec.effect.type === 'token-shield';
}

/**
 * `true` when applying `effect` would change at least one number.
 *
 * Deliberately conservative: it answers "would this do nothing", so a partial heal (5 missing,
 * 25 restored) still counts as useful. Weapons and materials are never usable from the bag.
 */
export function effectWouldDoSomething(
    effect: DropEffect,
    vitals: Vitals,
    ammo: AmmoSituation = { hasRangedWeapon: true },
): boolean {
    const hpMissing = Math.max(0, vitals.maxHp - vitals.hp);
    const spMissing = Math.max(0, vitals.maxSp - vitals.sp);

    switch (effect.type) {
        case 'instant':
            return ((effect.hp ?? 0) > 0 && hpMissing > 0) || ((effect.sp ?? 0) > 0 && spMissing > 0);
        case 'full-restore':
            return hpMissing > 0 || spMissing > 0;
        case 'refill-ammo':
            // The controller picks the slot; all this can say is whether a gun exists.
            return ammo.hasRangedWeapon;
        case 'weapon':
        case 'material':
            return false;
        default:
            return false;
    }
}