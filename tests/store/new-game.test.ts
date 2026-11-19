// @vitest-environment happy-dom
/**
 * tests/store/new-game.test.ts
 * --------------------------------------------------------------------------
 * "新游戏" must hand back every one-shot reward.
 *
 * The owner: `我点新游戏，确定清档新开的…在龙王王座上没有掉下白龙獠牙`. The console said
 * `every trigger already fired this run`, which means the save still held the throne key
 * AFTER the wipe - so this test drives the store directly and checks the list.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from '@/store/game-store';

const THRONE = 'gpt-sky-city-4-throne-hall:dragon-throne-fangs';

/** The stats call always carries the bars; only the name matters to these tests. */
const STATS = { name: 'Gemini', hp: 260, maxHp: 260, sp: 120, maxSp: 120 } as const;

beforeEach(() => {
    useGameStore.getState().clearSaveData({ wipeWorld: true });
});

describe('clearing the save', () => {
    it('forgets every trigger that was spent', () => {
        useGameStore.getState().markTriggerUsed(THRONE);
        expect(useGameStore.getState().usedTriggers).toContain(THRONE);

        useGameStore.getState().clearSaveData({ wipeWorld: true });

        expect(useGameStore.getState().usedTriggers).toEqual([]);
    });

    it('also forgets it with the plain call the death screen uses', () => {
        useGameStore.getState().markTriggerUsed(THRONE);
        useGameStore.getState().clearSaveData();

        expect(useGameStore.getState().usedTriggers).toEqual([]);
    });

    it('wipes the hidden map unlock on a new game as well', () => {
        useGameStore.getState().unlockHiddenMap();
        expect(useGameStore.getState().hiddenMapUnlocked).toBe(true);

        useGameStore.getState().clearSaveData({ wipeWorld: true });

        expect(useGameStore.getState().hiddenMapUnlocked).toBe(false);
    });
});

describe('the trigger key itself', () => {
    it('is written once and never grows a character suffix', () => {
        useGameStore.getState().markTriggerUsed(THRONE);
        useGameStore.getState().markTriggerUsed(THRONE);

        // Marking twice must not duplicate: a save with the key twice would still look
        // spent, but the list is what `?triggerDebug=1` prints.
        expect(useGameStore.getState().usedTriggers).toEqual([THRONE]);
    });
});

describe('the wipe is spelled out', () => {
    it('sets the trigger list to empty instead of inheriting it', () => {
        // A wipe that merely spreads `initialGameState` leaves the key alive if that object
        // ever starts carrying one; the explicit line is what makes the reset auditable.
        const store = readFileSync(
            join(process.cwd(), 'src', 'store', 'game-store.ts'),
            'utf8',
        );
        expect(store).toMatch(/usedTriggers: \[\],[\s\S]{0,200}hiddenMapUnlocked: false/);
        expect(store).toContain('[new-game] run wiped');
    });
});

describe('the nickname owns the name', () => {
    it('replaces the character name the moment it is set', () => {
        // `自己输入进去的名字没有顶替掉原本的名字` - the plate kept drawing the spec name.
        useGameStore.getState().setCharacterStats(STATS);
        expect(useGameStore.getState().characterName).toBe('Gemini');

        useGameStore.getState().setPlayerNickname('小鲸鱼');

        expect(useGameStore.getState().playerNickname).toBe('小鲸鱼');
        expect(useGameStore.getState().characterName).toBe('小鲸鱼');
    });

    it('survives a stats refresh, which happens on every HUD tick', () => {
        useGameStore.getState().setPlayerNickname('小鲸鱼');
        useGameStore.getState().setCharacterStats(STATS);

        expect(useGameStore.getState().characterName).toBe('小鲸鱼');
    });

    it('falls back to the character name when no nickname is set', () => {
        useGameStore.getState().setCharacterStats(STATS);

        expect(useGameStore.getState().characterName).toBe('Gemini');
    });
});
