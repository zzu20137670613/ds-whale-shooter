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
import { resolveAndRestart } from '@/lib/phaser-game';
import { useGameStore } from '@/store/game-store';

import { QUICK_SLOT_ID, type SaveSlotRecord } from './slots';

// 这里原来有个 `captureThumbnail()`：把画布缩成 160×90 的 JPEG 塞进存档。
// 主人 2026-11-16 看了真机上的存档界面，说缩成小格子后那个截图「很小显示效果很差」，
// 提议改用地图名那块小牌子 —— 存档本来就存了 `levelTitle` 和 `elapsedMs`，牌子可以现渲染，
// 不需要图片。截图这条路就整个撤掉了（每格也省下 5～10 KB 的 data URL）。

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
    const record = useGameStore.getState().saveToSlot(QUICK_SLOT_ID);
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