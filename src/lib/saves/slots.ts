/**
 * src/lib/saves/slots.ts
 * --------------------------------------------------------------------------
 * Save slots: their names, their labels, and the guard that keeps a corrupt slot
 * from taking the game down with it.
 *
 * The shape is modelled on the sixth-generation galgame (`D:\深海回响\deepseek-gal`),
 * which already solved this: a fixed rack of numbered slots plus a quick-save, each
 * record carrying a version, a timestamp, a thumbnail and a display name. The point
 * of copying it rather than inventing one is that players have already met that
 * rack — 存档 01..06 and a 快速存档 in the corner.
 *
 * Slots live in localStorage, one key each, deliberately separate from the running
 * save (`ds_whale_shooter_save_v2`): the autosave is "where you are", a slot is "where
 * you were". Mixing them would make every slot save overwrite the autosave.
 */

/** The numbered rack. Five, so the panel fits quick + 2 on the first row and 3 on the second. */
export const SAVE_SLOT_IDS = [1, 2, 3, 4, 5] as const;

/** The one slot the F5 / F9 hotkeys touch, kept apart from the rack. */
export const QUICK_SLOT_ID = 'quick' as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number] | typeof QUICK_SLOT_ID;

/** Bumped whenever the record shape changes; older records are then refused. */
export const SLOT_RECORD_VERSION = 1;

/** What a slot remembers. The payload is a snapshot of the persistent slice. */
export interface SaveSlotRecord {
    version: number;
    /** ISO timestamp, so the list can sort without guessing. */
    savedAt: string;
    /** Level the save was taken in — the one line a player actually reads. */
    levelTitle: string;
    levelId: string;
    /** Character on screen, for the same reason. */
    characterName: string;
    /** Wall-clock time in the level, shown as mm:ss. */
    elapsedMs: number;
    money: number;
    /** A small JPEG data URL of the moment, or undefined when capture failed. */
    thumbnail?: string;
    /** The persistent slice, verbatim. */
    data: Record<string, unknown>;
}

/** localStorage key for one slot. Slots and the autosave never share a key. */
export function saveSlotKey(id: SaveSlotId): string {
    return id === QUICK_SLOT_ID ? 'ds_whale_shooter_quicksave' : `ds_whale_shooter_slot_${id}`;
}

/** "快速存档" or "存档 03" — the label a slot card shows. */
export function slotLabel(id: SaveSlotId): string {
    return id === QUICK_SLOT_ID ? '快速存档' : `存档 ${String(id).padStart(2, '0')}`;
}

/** mm:ss, widening to h:mm:ss only when a run is long enough to need it. */
export function formatPlaytime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * When it was saved, in local time, without pulling in a date library.
 *
 * Deliberately terse: the card already shows the level and the playtime, so the
 * date is only there to tell two saves of the same level apart.
 */
export function formatSavedAt(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Is this parsed JSON actually one of our slot records?
 *
 * localStorage is user-editable and survives schema changes, so a slot is parsed
 * defensively: a record from a future version is refused rather than half-applied,
 * and a missing payload is refused outright.
 */
export function isSaveSlotRecord(raw: unknown): raw is SaveSlotRecord {
    if (!raw || typeof raw !== 'object') return false;
    const record = raw as Partial<SaveSlotRecord>;
    return (
        record.version === SLOT_RECORD_VERSION &&
        typeof record.savedAt === 'string' &&
        typeof record.levelTitle === 'string' &&
        typeof record.levelId === 'string' &&
        typeof record.characterName === 'string' &&
        typeof record.elapsedMs === 'number' &&
        typeof record.money === 'number' &&
        !!record.data &&
        typeof record.data === 'object'
    );
}
