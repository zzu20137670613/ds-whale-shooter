// @vitest-environment happy-dom
/**
 * tests/lib/saves/slots.test.ts
 * --------------------------------------------------------------------------
 * The slot rack: naming, labels, the playtime clock, and the guard that refuses a
 * record it does not understand.
 *
 * The store half is exercised through the real store, because the thing that bites
 * is the separation between the autosave key and the slot keys — a slot save that
 * wrote to `ds_whale_shooter_save_v2` would silently destroy the autosave.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    QUICK_SLOT_ID,
    SAVE_SLOT_IDS,
    SLOT_RECORD_VERSION,
    formatPlaytime,
    formatSavedAt,
    isSaveSlotRecord,
    saveSlotKey,
    slotLabel,
} from '@/lib/saves/slots';
import { initialGameState, useGameStore } from '@/store/game-store';

const AUTOSAVE_KEY = 'ds_whale_shooter_save_v2';

describe('slot naming', () => {
    it('has a five-slot rack plus the quick slot', () => {
        // The owner trimmed the rack: quick save first, then five numbered slots so the
        // panel can show three per row (quick + 2, then 3).
        expect(SAVE_SLOT_IDS).toEqual([1, 2, 3, 4, 5]);
        expect(QUICK_SLOT_ID).toBe('quick');
    });

    it('lists the quick slot before the rack', () => {
        expect([QUICK_SLOT_ID, ...SAVE_SLOT_IDS]).toEqual(['quick', 1, 2, 3, 4, 5]);
    });

    it('never lets a slot share the autosave key', () => {
        const keys = [...SAVE_SLOT_IDS.map((id) => saveSlotKey(id)), saveSlotKey(QUICK_SLOT_ID)];
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).not.toContain(AUTOSAVE_KEY);
    });

    it('labels the rack by number and the quick slot by name', () => {
        expect(slotLabel(1)).toBe('存档 01');
        expect(slotLabel(5)).toBe('存档 05');
        expect(slotLabel(QUICK_SLOT_ID)).toBe('快速存档');
    });
});

describe('formatPlaytime', () => {
    it('is mm:ss under an hour', () => {
        expect(formatPlaytime(0)).toBe('00:00');
        expect(formatPlaytime(65_000)).toBe('01:05');
        expect(formatPlaytime(59 * 60_000 + 59_000)).toBe('59:59');
    });

    it('widens to h:mm:ss past an hour', () => {
        expect(formatPlaytime(3_600_000)).toBe('1:00:00');
        expect(formatPlaytime(3_725_000)).toBe('1:02:05');
    });

    it('does not go negative', () => {
        expect(formatPlaytime(-5000)).toBe('00:00');
    });
});

describe('formatSavedAt', () => {
    it('renders a date as y-m-d h:m', () => {
        expect(formatSavedAt('2026-10-28T09:05:00')).toBe('2026-10-28 09:05');
    });

    it('shows a dash for rubbish', () => {
        expect(formatSavedAt('not a date')).toBe('—');
    });
});

describe('isSaveSlotRecord', () => {
    const good = {
        version: SLOT_RECORD_VERSION,
        savedAt: '2026-10-28T09:05:00.000Z',
        levelTitle: '沙滩',
        levelId: 'beach-holiday',
        characterName: '鲸鲸',
        elapsedMs: 1000,
        money: 10,
        data: { hp: 100 },
    };

    it('accepts a record this build wrote', () => {
        expect(isSaveSlotRecord(good)).toBe(true);
    });

    it('refuses another version rather than half-applying it', () => {
        expect(isSaveSlotRecord({ ...good, version: SLOT_RECORD_VERSION + 1 })).toBe(false);
    });

    it('refuses a record with no payload', () => {
        expect(isSaveSlotRecord({ ...good, data: undefined })).toBe(false);
        expect(isSaveSlotRecord(null)).toBe(false);
        expect(isSaveSlotRecord('{}')).toBe(false);
    });
});

describe('the store side', () => {
    beforeEach(() => {
        window.localStorage.clear();
        useGameStore.setState({ ...initialGameState });
    });

    it('refuses to save before a level has started', () => {
        expect(useGameStore.getState().saveToSlot(1)).toBeNull();
    });

    it('round-trips a run through a slot', () => {
        useGameStore.setState({
            currentLevelId: 'beach-holiday',
            levelTitle: '沙滩',
            characterName: '鲸鲸',
            money: 42,
            levelElapsedMs: 95_000,
            hp: 70,
        });

        // The autosave is written by persist on every set, so what matters is that a
        // slot save does not CHANGE it.
        const autosaveBefore = window.localStorage.getItem(AUTOSAVE_KEY);

        const record = useGameStore.getState().saveToSlot(2);
        expect(record?.levelTitle).toBe('沙滩');
        expect(record?.money).toBe(42);
        expect(window.localStorage.getItem(saveSlotKey(2))).toBeTruthy();
        expect(window.localStorage.getItem(AUTOSAVE_KEY)).toBe(autosaveBefore);

        // Move away, then load the slot back.
        useGameStore.setState({ money: 0, hp: 1, currentLevelId: '' });
        expect(useGameStore.getState().loadFromSlot(2)).toBe(true);
        expect(useGameStore.getState().money).toBe(42);
        expect(useGameStore.getState().hp).toBe(70);
        expect(useGameStore.getState().currentLevelId).toBe('beach-holiday');
    });

    it('lists five empty rack slots plus the quick one before anything is saved', () => {
        const slots = useGameStore.getState().listSaveSlots();
        expect(Object.keys(slots)).toHaveLength(6);
        expect(Object.values(slots).every((slot) => slot === null)).toBe(true);
    });

    it('deletes a slot and reports it empty again', () => {
        useGameStore.setState({ currentLevelId: 'beach-holiday', money: 1 });
        useGameStore.getState().saveToSlot(3);
        expect(useGameStore.getState().listSaveSlots()[3]).not.toBeNull();

        useGameStore.getState().deleteSaveSlot(3);
        expect(useGameStore.getState().listSaveSlots()[3]).toBeNull();
    });

    it('treats corrupt data as an empty slot instead of throwing', () => {
        window.localStorage.setItem(saveSlotKey(4), '{not json');
        expect(useGameStore.getState().listSaveSlots()[4]).toBeNull();
        expect(useGameStore.getState().loadFromSlot(4)).toBe(false);
    });

    it('keeps a thumbnail when one is handed in', () => {
        useGameStore.setState({ currentLevelId: 'beach-holiday' });
        const record = useGameStore.getState().saveToSlot(QUICK_SLOT_ID, 'data:image/jpeg;base64,AAA');
        expect(record?.thumbnail).toBe('data:image/jpeg;base64,AAA');
    });
});