/**
 * tests/lib/drops/token-shield-bag.test.ts
 * --------------------------------------------------------------------------
 * 词元盾的等级 = 背包里有几个（上限 5）。
 *
 * The owner, 2026-11-12: `词元盾生效的等级应该跟随背包里有几个的（最大 5），读档的时候 buff 就掉了，
 * 实际背包里有词元盾`。 The bag is the only thing that survives a save/load, so it has to be the
 * source of truth — the per-character table stays only as a fallback for older saves.
 */

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TOKEN_SHIELD_DROP_ID, tokenShieldLevelOf } from '@/lib/drops/token-shield-store';
import { tokenShieldLevelFromCount } from '@/lib/drops/token-shield';
import { initialGameState, useGameStore } from '@/store/game-store';

function giveShields(count: number): void {
    useGameStore.setState({
        inventory: count > 0 ? [{ dropId: TOKEN_SHIELD_DROP_ID, count }] : [],
    });
}

describe('tokenShieldLevelFromCount', () => {
    it('is the count, capped at ten', () => {
        // 主人 2026-11-15：`将词元盾的5级上限改为10级`。
        expect(tokenShieldLevelFromCount(0)).toBe(0);
        expect(tokenShieldLevelFromCount(1)).toBe(1);
        expect(tokenShieldLevelFromCount(5)).toBe(5);
        expect(tokenShieldLevelFromCount(9)).toBe(9);
        expect(tokenShieldLevelFromCount(10)).toBe(10);
        expect(tokenShieldLevelFromCount(15)).toBe(10);
    });

    it('survives junk values', () => {
        expect(tokenShieldLevelFromCount(-2)).toBe(0);
        expect(tokenShieldLevelFromCount(Number.NaN)).toBe(0);
    });
});

describe('the level in effect', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState, selectedCharacterId: 'deepseek' });
    });

    afterEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('follows what the bag holds, so a reload cannot lose the buff', () => {
        giveShields(3);
        // Deliberately empty per-character table: this is the save-after-reload state that
        // used to drop the buff.
        useGameStore.setState({ tokenShieldByCharacter: {} });
        expect(tokenShieldLevelOf('deepseek')).toBe(3);
    });

    it('still reads the old per-character table when the bag is empty', () => {
        giveShields(0);
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 2 } });
        expect(tokenShieldLevelOf('deepseek')).toBe(2);
    });

    it('is zero with neither source', () => {
        giveShields(0);
        expect(tokenShieldLevelOf('deepseek')).toBe(0);
    });

    it('prefers the bag when the two disagree', () => {
        giveShields(4);
        useGameStore.setState({ tokenShieldByCharacter: { deepseek: 1 } });
        expect(tokenShieldLevelOf('deepseek')).toBe(4);
    });
});