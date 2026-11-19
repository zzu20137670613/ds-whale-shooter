/**
 * tests/lib/saves/file.test.ts
 * --------------------------------------------------------------------------
 * Exporting the rack to one file and reading it back.
 *
 * The interesting cases are all about refusal: a file from another version, a file
 * that is really someone's shopping list, a file whose only slot is corrupt. Each has
 * to fail in a way the player can act on, not by half-loading a run.
 */

import { describe, expect, it } from 'vitest';

import {
    AUTOSAVE_KEY,
    SAVE_FILE_FORMAT,
    applySaveFile,
    buildSaveFile,
    describedSlotIds,
    parseSaveFile,
    saveFileName,
} from '@/lib/saves/file';
import { QUICK_SLOT_ID, SLOT_RECORD_VERSION, saveSlotKey } from '@/lib/saves/slots';
import type { SaveSlotRecord } from '@/lib/saves/slots';

/** A tiny in-memory stand-in for localStorage. */
function memoryStorage(seed: Record<string, string> = {}) {
    const map = new Map(Object.entries(seed));
    return {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
            map.set(key, value);
        },
        removeItem: (key: string) => {
            map.delete(key);
        },
        has: (key: string) => map.has(key),
        dump: () => Object.fromEntries(map),
    };
}

function record(overrides: Partial<SaveSlotRecord> = {}): SaveSlotRecord {
    return {
        version: SLOT_RECORD_VERSION,
        savedAt: '2026-10-28T09:05:00.000Z',
        levelTitle: '沙滩',
        levelId: 'beach-holiday',
        characterName: '鲸鲸',
        elapsedMs: 65_000,
        money: 120,
        data: { hp: 90 },
        ...overrides,
    };
}

describe('buildSaveFile', () => {
    it('carries every slot plus the autosave', () => {
        const storage = memoryStorage({
            [saveSlotKey(1)]: JSON.stringify(record()),
            [saveSlotKey(QUICK_SLOT_ID)]: JSON.stringify(record({ money: 7 })),
            [AUTOSAVE_KEY]: '{"state":{"hp":1}}',
        });

        const file = buildSaveFile(storage);
        expect(file.format).toBe(SAVE_FILE_FORMAT);
        expect(file.version).toBe(SLOT_RECORD_VERSION);
        expect(Object.keys(file.slots)).toHaveLength(2);
        expect(file.autosave).toBe('{"state":{"hp":1}}');
    });

    it('skips a corrupt slot instead of losing the whole export', () => {
        const storage = memoryStorage({
            [saveSlotKey(1)]: '{not json',
            [saveSlotKey(2)]: JSON.stringify(record()),
        });
        const file = buildSaveFile(storage);
        expect(Object.keys(file.slots)).toEqual([saveSlotKey(2)]);
    });

    it('exports an empty rack as an empty file rather than throwing', () => {
        const file = buildSaveFile(memoryStorage());
        expect(file.slots).toEqual({});
        expect(file.autosave).toBeNull();
    });
});

describe('parseSaveFile', () => {
    it('round-trips what buildSaveFile wrote', () => {
        const storage = memoryStorage({ [saveSlotKey(3)]: JSON.stringify(record()) });
        const text = JSON.stringify(buildSaveFile(storage));

        const parsed = parseSaveFile(text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(describedSlotIds(parsed.file)).toEqual([3]);
    });

    it('refuses a file that is not JSON', () => {
        expect(parseSaveFile('nope')).toEqual({ ok: false, reason: 'not-json' });
    });

    it('refuses JSON that is not our save file', () => {
        expect(parseSaveFile('{"hello":"world"}')).toEqual({ ok: false, reason: 'not-a-save' });
    });

    it('refuses another version rather than half-applying it', () => {
        const file = buildSaveFile(memoryStorage({ [saveSlotKey(1)]: JSON.stringify(record()) }));
        const text = JSON.stringify({ ...file, version: SLOT_RECORD_VERSION + 1 });
        expect(parseSaveFile(text)).toEqual({ ok: false, reason: 'wrong-version' });
    });

    it('refuses a file with nothing usable inside', () => {
        const text = JSON.stringify({
            format: SAVE_FILE_FORMAT,
            version: SLOT_RECORD_VERSION,
            exportedAt: '2026-10-28T00:00:00.000Z',
            slots: {},
            autosave: null,
        });
        expect(parseSaveFile(text)).toEqual({ ok: false, reason: 'empty' });
    });

    it('drops slot keys it does not own', () => {
        const file = buildSaveFile(memoryStorage({ [saveSlotKey(1)]: JSON.stringify(record()) }));
        const text = JSON.stringify({
            ...file,
            slots: { ...file.slots, 'not_our_key': record() },
        });
        const parsed = parseSaveFile(text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(Object.keys(parsed.file.slots)).toEqual([saveSlotKey(1)]);
    });
});

describe('applySaveFile', () => {
    it('writes the slots and the autosave back', () => {
        const source = memoryStorage({
            [saveSlotKey(2)]: JSON.stringify(record({ money: 5 })),
            [AUTOSAVE_KEY]: '{"state":{}}',
        });
        const file = buildSaveFile(source);

        const target = memoryStorage();
        const result = applySaveFile(target, file);
        expect(result).toEqual({ slotsWritten: 1, autosaveWritten: true });
        expect(target.has(saveSlotKey(2))).toBe(true);
        expect(target.has(AUTOSAVE_KEY)).toBe(true);
    });
});

describe('saveFileName', () => {
    it('stamps the date so two exports do not collide', () => {
        expect(saveFileName(new Date(2026, 9, 28, 15, 42))).toBe(
            'ds-whale-shooter-save-20261028-1542.json',
        );
    });
});