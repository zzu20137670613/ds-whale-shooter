/**
 * src/lib/saves/quick.ts
 * --------------------------------------------------------------------------
 * The quick slot, and the three ways to reach it: F5, the panel, and arriving in a new
 * level.
 *
 * All three go through one function so they cannot drift apart — the auto save after a
 * map change has to write exactly what the hotkey writes, or a player who relies on
 * one and a player who relies on the other would load different things.
 */

import { EventBus } from '@/lib/events/bus';
import { SAVE_TOAST_EVENT, SAVE_TOAST_MS } from '@/lib/constants';
import { getPhaserGame, resolveAndRestart } from '@/lib/phaser-game';
import { useGameStore } from '@/store/game-store';

import { QUICK_SLOT_ID, type SaveSlotRecord } from './slots';

/** A small JPEG of the running scene, or undefined when the canvas cannot be read. */
export function captureThumbnail(canvas?: HTMLCanvasElement | null): string | undefined {
    try {
        const source = canvas ?? getPhaserGame()?.canvas;
        if (!source) return undefined;
        const thumb = document.createElement('canvas');
        thumb.width = 160;
        thumb.height = 90;
        const ctx = thumb.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(source, 0, 0, thumb.width, thumb.height);
        return thumb.toDataURL('image/jpeg', 0.6);
    } catch {
        // Tainted canvas or a lost context: the save is still worth taking.
        return undefined;
    }
}

/** Tell the HUD to show a line. Fire-and-forget. */
export function announceSave(message: string): void {
    EventBus.emit(SAVE_TOAST_EVENT, { message, ms: SAVE_TOAST_MS });
}

/**
 * Write the quick slot.
 *
 * Returns null when there was nothing to save (no level yet), which the caller shows as
 * "not yet" rather than as a failure.
 */
export function quickSave(note?: string): SaveSlotRecord | null {
    const record = useGameStore.getState().saveToSlot(QUICK_SLOT_ID, captureThumbnail());
    if (record && note) announceSave(note);
    return record;
}

/**
 * Load the quick slot and restart the level it was taken in.
 *
 * Returns false when the slot is empty or unreadable, so the HUD can say so instead of
 * silently doing nothing.
 */
export function quickLoad(): boolean {
    const record = useGameStore.getState().listSaveSlots()[QUICK_SLOT_ID];
    if (!record) return false;
    if (!useGameStore.getState().loadFromSlot(QUICK_SLOT_ID)) return false;
    void resolveAndRestart(record.levelId);
    return true;
}