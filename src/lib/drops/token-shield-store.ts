/**
 * src/lib/drops/token-shield-store.ts
 * --------------------------------------------------------------------------
 * The 词元盾 level as it lives on a character: read it, hand out one pickup.
 *
 * Kept apart from `token-shield.ts` so the pure ladder stays testable without
 * pulling in the store, and apart from the scene code so both the pickup and the
 * damage choke point read the same source.
 */

import { useGameStore } from '@/store/game-store';

import { countOf } from '@/lib/inventory';

import {
    collectTokenShield,
    tokenShieldLevelFromCount,
    type TokenShieldPickup,
} from './token-shield';

/** How many Token Shields the bag is holding right now. */
/** The drop id whose bag count IS the shield level. */
export const TOKEN_SHIELD_DROP_ID = 'token-shield';

export function tokenShieldCount(): number {
    return countOf(useGameStore.getState().inventory, TOKEN_SHIELD_DROP_ID);
}

/**
 * The shield level in effect right now (0 = none).
 *
 * The BAG is the source of truth — it is the thing that survives a save/load, and the owner
 * asked for exactly that (`跟随背包里有几个`). The per-character table is kept as a fallback for
 * saves written before the bag was used, so an old file cannot silently lose its buff.
 */
export function tokenShieldLevelOf(characterId: string | null | undefined): number {
    const fromBag = tokenShieldLevelFromCount(tokenShieldCount());
    if (fromBag > 0) return fromBag;
    if (!characterId) return 0;
    return tokenShieldLevelFromCount(
        useGameStore.getState().tokenShieldByCharacter[characterId] ?? 0,
    );
}

/**
 * Apply one pickup to a character.
 *
 * The level is written back onto that character only, which is exactly the
 * "follows this character, gone when you swap" rule the owner asked for. With no
 * character selected there is nowhere to write, so the pickup just reports what
 * it would have done.
 */
export function grantTokenShield(characterId: string | null | undefined): TokenShieldPickup {
    // 先按"已经捡了几个"算这次的结果，再把它放进背包 —— 背包是唯一真相，
    // 拾取和读档走同一条路，buff 不会因为读档而消失。
    const pickup = collectTokenShield(tokenShieldCount());
    useGameStore.getState().addInventoryItem(TOKEN_SHIELD_DROP_ID, 1);
    if (characterId) {
        useGameStore.setState((state) => ({
            tokenShieldByCharacter: {
                ...state.tokenShieldByCharacter,
                [characterId]: pickup.level,
            },
        }));
    }
    return pickup;
}
