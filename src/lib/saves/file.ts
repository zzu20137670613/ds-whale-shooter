/**
 * src/lib/saves/file.ts
 * --------------------------------------------------------------------------
 * Save files: the whole rack in one JSON document, and the guard that reads it back.
 *
 * The galgame ships "保存到文件" / "从文件读取" for the same two reasons this exists:
 * a slot rack that only lives in localStorage is one cleared cache away from gone, and
 * a file is the only way to carry a run to another machine.
 *
 * The file is a bag of keys, not a re-modelled save: whatever this build writes, this
 * build can read back, and a file from another version is refused whole rather than
 * half-applied.
 */

import {
    QUICK_SLOT_ID,
    SAVE_SLOT_IDS,
    SLOT_RECORD_VERSION,
    isSaveSlotRecord,
    saveSlotKey,
    type SaveSlotId,
    type SaveSlotRecord,
} from './slots';

/** Written into the file so a reader knows what it is before parsing the rest. */
export const SAVE_FILE_FORMAT = '11th-forest-save';

/** Every key a save file may carry: the rack, then the autosave. */
export const SAVE_FILE_KEYS = [
    ...SAVE_SLOT_IDS.map((id) => saveSlotKey(id)),
    saveSlotKey(QUICK_SLOT_ID),
] as const;

/** The autosave key, exported alongside the rack so "one file" really means one file. */
export const AUTOSAVE_KEY = '11th_forest_save_v2';

export interface SaveFile {
    format: typeof SAVE_FILE_FORMAT;
    version: number;
    exportedAt: string;
    /** Slot key -> record. Only slots that actually hold something are present. */
    slots: Record<string, SaveSlotRecord>;
    /** The live autosave blob, verbatim; null when the file was made before a run. */
    autosave: string | null;
}

/**
 * Build a save file from whatever the storage currently holds.
 *
 * Unreadable slots are skipped rather than aborting the export: one corrupt slot must
 * not cost the player the other five.
 */
export function buildSaveFile(storage: Pick<Storage, 'getItem'>, now = new Date()): SaveFile {
    const slots: Record<string, SaveSlotRecord> = {};
    for (const key of SAVE_FILE_KEYS) {
        const raw = storage.getItem(key);
        if (!raw) continue;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (isSaveSlotRecord(parsed)) slots[key] = parsed;
        } catch {
            // Skip the corrupt one, keep going.
        }
    }
    return {
        format: SAVE_FILE_FORMAT,
        version: SLOT_RECORD_VERSION,
        exportedAt: now.toISOString(),
        slots,
        autosave: storage.getItem(AUTOSAVE_KEY),
    };
}

export type ParsedSaveFile =
    | { ok: true; file: SaveFile }
    | { ok: false; reason: 'not-json' | 'not-a-save' | 'wrong-version' | 'empty' };

/**
 * Read a save file back.
 *
 * Refused whole when the version does not match, because a partially understood save
 * is worse than an obviously rejected one: the player would load into a run with the
 * right level and the wrong inventory.
 */
export function parseSaveFile(text: string): ParsedSaveFile {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { ok: false, reason: 'not-json' };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'not-a-save' };

    const file = parsed as Partial<SaveFile>;
    if (file.format !== SAVE_FILE_FORMAT) return { ok: false, reason: 'not-a-save' };
    if (file.version !== SLOT_RECORD_VERSION) return { ok: false, reason: 'wrong-version' };

    const slots: Record<string, SaveSlotRecord> = {};
    for (const [key, record] of Object.entries(file.slots ?? {})) {
        if (SAVE_FILE_KEYS.includes(key as (typeof SAVE_FILE_KEYS)[number]) && isSaveSlotRecord(record)) {
            slots[key] = record;
        }
    }
    const autosave = typeof file.autosave === 'string' ? file.autosave : null;
    if (Object.keys(slots).length === 0 && !autosave) return { ok: false, reason: 'empty' };

    return {
        ok: true,
        file: {
            format: SAVE_FILE_FORMAT,
            version: SLOT_RECORD_VERSION,
            exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
            slots,
            autosave,
        },
    };
}

/**
 * Write a parsed file into storage.
 *
 * Unknown keys are impossible by construction (`parseSaveFile` filtered them), and the
 * autosave is written last so a quota failure leaves the slot rack intact.
 */
export function applySaveFile(
    storage: Pick<Storage, 'setItem'>,
    file: SaveFile,
): { slotsWritten: number; autosaveWritten: boolean } {
    let slotsWritten = 0;
    for (const [key, record] of Object.entries(file.slots)) {
        storage.setItem(key, JSON.stringify(record));
        slotsWritten += 1;
    }
    let autosaveWritten = false;
    if (file.autosave) {
        storage.setItem(AUTOSAVE_KEY, file.autosave);
        autosaveWritten = true;
    }
    return { slotsWritten, autosaveWritten };
}

/** A stable file name: the date it was taken, so two exports never collide. */
export function saveFileName(now = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `11th-forest-save-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** The slot ids a file carries, for a one-line summary after an import. */
export function describedSlotIds(file: SaveFile): SaveSlotId[] {
    return [...SAVE_SLOT_IDS, QUICK_SLOT_ID].filter((id) => !!file.slots[saveSlotKey(id)]);
}