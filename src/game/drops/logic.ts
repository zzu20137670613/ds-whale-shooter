/**
 * src/game/drops/logic.ts
 * --------------------------------------------------------------------------
 * Pure effect dispatch for drop pickups. Caller supplies the receivers
 * (character + weapons); this module only decides what the effect does.
 *
 * Returning a small "weapon pickup request" object lets the caller
 * delegate the actual hotbar mutation to whoever owns the weapon system.
 */

import type { DropEffect, DropSpec } from '@/lib/drops';

export interface DropEffectResult {
    /** `true` if the receiving weapon should be swapped (type=weapon). */
    requestWeaponSwap?: string;
}

/**
 * Apply `spec.effect` to the supplied receivers. Pure with respect to
 * side-effecting sinks — callers must invoke the actions (heal, refill,
 * swap) themselves.
 */
export function planDropEffect(
    spec: DropSpec,
    sinks: {
        heal: (hpDelta: number, spDelta: number) => void;
        refillAmmo: (fraction: number) => void;
        /** Refill HP and SP to their maxima (drop type=full-restore). */
        fullRestore: () => void;
        /** 词元盾：升级（满级后由调用方补满血蓝）。 */
        applyTokenShield: () => void;
        onWeaponPickup: (weaponId: string) => void;
    },
): DropEffectResult {
    const e = spec.effect;
    switch (e.type) {
        case 'instant':
            sinks.heal(e.hp ?? 0, e.sp ?? 0);
            return {};
        case 'refill-ammo':
            sinks.refillAmmo(e.ammoFraction);
            return {};
        case 'full-restore':
            sinks.fullRestore();
            return {};
        case 'weapon':
            sinks.onWeaponPickup(e.weaponId);
            return { requestWeaponSwap: e.weaponId };
        case 'token-shield':
            sinks.applyTokenShield();
            return {};
        case 'max-bonus':
            // 加冕之冠：**拾取时什么也不做**。它的加成是"带在身上"的被动，
            // 由 `resolve-scene` 每次开场景时按背包重算（见 `lib/drops/held-bonus.ts`）。
            // 在这里加一次会变成"拾取永久 +100"，和主人选的那条不一样。
            return {};
        case 'material':
            // Nothing to apply: a material is dead weight until it is sold.
            // The backpack (and later the shop) is what gives it value.
            return {};
        default: {
            // exhaustiveness check at compile-time
            const _exhaustive: never = e;
            void _exhaustive;
            return {};
        }
    }
}

/** Re-export of DropSpec / DropEffect for callers that want to bundle them. */
export type { DropEffect, DropSpec };
