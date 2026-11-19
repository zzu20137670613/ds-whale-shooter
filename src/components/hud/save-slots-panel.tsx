/**
 * src/components/hud/save-slots-panel.tsx
 * --------------------------------------------------------------------------
 * The save rack: one quick slot and six numbered ones, each card a small window into
 * the moment it holds.
 *
 * Modelled on the galgame's rack (see the header of `src/lib/saves/slots.ts`): a
 * thumbnail, the level, how long the run had lasted, the money, and when it was
 * written. Overwriting is a two-step click rather than a `confirm()` dialog — a
 * modal on top of a modal on top of a paused scene is how players lose runs.
 *
 * Loading does not reload the page: it applies the slot to the store and asks Phaser
 * to restart the saved level, so the transition stays inside the game.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Save, Trash2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    QUICK_SLOT_ID,
    SAVE_SLOT_IDS,
    formatPlaytime,
    formatSavedAt,
    slotLabel,
    type SaveSlotId,
    type SaveSlotRecord,
} from '@/lib/saves/slots';
import {
    applySaveFile,
    buildSaveFile,
    parseSaveFile,
    saveFileName,
} from '@/lib/saves/file';
import { announceSave } from '@/lib/saves/quick';
import { reloadPageForSave } from '@/lib/saves/reload';
import { t } from '@/locales';
import { isMobileLike } from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

import { CornerPixels, RETRO_BOX } from './retro-box';
import { SaveSlotPlate } from './save-slot-plate';

interface SaveSlotsPanelProps {
    onClose: () => void;
    /**
     * Called after a slot has been applied and the level restart kicked off. The host needs
     * this because the scene it paused is about to be destroyed: without it the pause menu
     * kept holding a dead scene and could not be closed.
     */
    onLoaded?: () => void;
}

export function SaveSlotsPanel({ onClose, onLoaded }: SaveSlotsPanelProps) {
    /**
     * 手机端要压缩一档。
     *
     * 主人 2026-11-16（手机实测）：`手机端存档读档的高度加高，露一行出来，或者整体等比缩小
     * 一丢丢`，通过标准是「至少一行存档读档要显示全」。模拟器/平板高度高，测不出来。
     *
     * 桌面那套尺寸（1080px 宽、84px 缩略图、16px 字）在横屏手机上把一行卡片的下半截
     * 顶出屏幕，所以这里**整体等比缩小**：卡片间距、缩略图、内边距一起收，字体保持可读。
     */
    const mobile = isMobileLike();
    const listSaveSlots = useGameStore((s) => s.listSaveSlots);
    const saveToSlot = useGameStore((s) => s.saveToSlot);
    const loadFromSlot = useGameStore((s) => s.loadFromSlot);
    const deleteSaveSlot = useGameStore((s) => s.deleteSaveSlot);

    const [slots, setSlots] = useState(() => listSaveSlots());
    /** The slot waiting for a second click, i.e. "you are about to overwrite this". */
    const [pendingOverwrite, setPendingOverwrite] = useState<SaveSlotId | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const refresh = useCallback(() => setSlots(listSaveSlots()), [listSaveSlots]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Quick save leads: it is the one the hotkeys write, and the row reads better with
    // the odd slot out first (quick + 2, then 3).
    const ids = useMemo<SaveSlotId[]>(() => [QUICK_SLOT_ID, ...SAVE_SLOT_IDS], []);

    function handleSave(id: SaveSlotId) {
        const existing = slots[id];
        if (existing && pendingOverwrite !== id) {
            setPendingOverwrite(id);
            setNotice(null);
            return;
        }
        // 不再截图：那块牌子是现渲染的，见 `save-slot-plate.tsx`。
        const record = saveToSlot(id);
        setPendingOverwrite(null);
        setNotice(record ? t('saves.saved') : t('saves.saveFailed'));
        refresh();
    }

    function handleLoad(id: SaveSlotId) {
        const record = slots[id];
        if (!record) return;
        if (!loadFromSlot(id)) {
            setNotice(t('saves.loadFailed'));
            return;
        }
        // A FULL page load, not an in-place scene restart.
        //
        // Restarting the scene in place kept the old level's textures and the old scene
        // instance around: the owner loaded a save taken in 天空之城 and got Atlantis's
        // artwork under 天空之城's title, with no player on screen
        // (`从天空直接去往亚特兰蒂斯出现了这种情况`). Reloading throws all of that away - the
        // store is persisted, so the boot comes back to exactly this save.
        onClose();
        onLoaded?.();
        announceSave(t('saves.loaded'));
        reloadPageForSave();
    }

    function handleExport() {
        try {
            const file = buildSaveFile(window.localStorage);
            const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = saveFileName();
            link.click();
            // Revoke on the next tick: Safari drops the download if the URL dies first.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            announceSave(t('saves.exported'));
        } catch {
            announceSave(t('saves.exportFailed'));
        }
    }

    function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.target;
        const file = input.files?.[0];
        // Reset first, so picking the same file twice still fires a change.
        input.value = '';
        if (!file) return;

        void file
            .text()
            .then((text) => {
                const parsed = parseSaveFile(text);
                if (!parsed.ok) {
                    announceSave(t('saves.importFailed'));
                    return;
                }
                const result = applySaveFile(window.localStorage, parsed.file);
                refresh();
                announceSave(`${t('saves.imported')} ×${result.slotsWritten}`);
            })
            .catch(() => announceSave(t('saves.importFailed')));
    }

    function handleDelete(id: SaveSlotId) {
        deleteSaveSlot(id);
        setPendingOverwrite(null);
        refresh();
    }

    return (
        <div
            data-testid="save-slots-panel"
            onClick={onClose}
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`${RETRO_BOX} relative flex w-[67.5rem] max-w-[calc(100vw-2rem)] flex-col font-['Silkscreen',monospace] overflow-y-auto ${
                    mobile
                        ? 'gap-2 px-3 py-3 max-h-[calc(100vh-0.5rem)]'
                        : 'gap-[1.125rem] px-[1.875rem] py-6 max-h-[calc(100vh-2rem)]'
                }`}
            >
                <CornerPixels />
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-2 right-2 text-stone-500 transition-colors hover:text-amber-400"
                >
                    <X className="size-[1.875rem]" />
                </button>

                <div className="flex items-center gap-2">
                    <span className="h-px flex-1 bg-amber-800/50" />
                    <span className="text-lg font-bold tracking-[0.3em] text-amber-400 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {t('saves.title')}
                    </span>
                    <span className="h-px flex-1 bg-amber-800/50" />
                </div>

                <div
                    className={`grid grid-cols-3 overflow-y-auto pr-[0.375rem] ${
                        mobile
                            ? 'max-h-[calc(100vh-7.5rem)] gap-2'
                            : 'max-h-[33rem] gap-3'
                    }`}
                >
                    {ids.map((id) => {
                        const record: SaveSlotRecord | null = slots[id];
                        const confirming = pendingOverwrite === id;
                        return (
                            <div
                                key={String(id)}
                                data-save-slot={String(id)}
                                className={`flex flex-col rounded border border-stone-700/80 bg-stone-900/70 ${
                                    mobile ? 'gap-1 p-2' : 'gap-[0.5rem] p-3'
                                }`}
                            >
                                <div className="flex items-center justify-between text-[16px] tracking-widest text-stone-400 uppercase">
                                    <span>{slotLabel(id)}</span>
                                    {record && <span>{formatSavedAt(record.savedAt)}</span>}
                                </div>

                                {record ? (
                                    // 地图名小牌子当缩略图（主人 2026-11-16：截图太小太糊）。
                                    <div
                                        className={
                                            mobile
                                                ? 'flex h-[3rem] items-center'
                                                : 'flex h-[5.25rem] items-center'
                                        }
                                    >
                                        <SaveSlotPlate
                                            title={record.levelTitle}
                                            elapsedMs={record.elapsedMs}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className={`flex w-full items-center justify-center rounded-sm border border-dashed border-stone-700 text-[16px] tracking-wider text-stone-600 uppercase ${
                                            mobile ? 'h-[3rem]' : 'h-[5.25rem]'
                                        }`}
                                    >
                                        {t('saves.empty')}
                                    </div>
                                )}

                                {record && (
                                    <div className="flex items-center justify-between text-[16px] text-stone-400">
                                        <span>{formatPlaytime(record.elapsedMs)}</span>
                                        <span>{record.money} G</span>
                                    </div>
                                )}

                                <div className="mt-auto flex items-center gap-[0.375rem]">
                                    <Button
                                        type="button"
                                        onClick={() => handleSave(id)}
                                        title={confirming ? t('saves.overwrite') : t('saves.save')}
                                        className={`h-9 flex-1 px-[0.375rem] text-[16px] font-semibold ${
                                            confirming
                                                ? 'bg-red-600 text-white hover:bg-red-500'
                                                : 'bg-amber-500 text-black hover:bg-amber-400'
                                        }`}
                                    >
                                        <Save className="size-[1.125rem]" />
                                        {confirming ? t('saves.overwrite') : t('saves.save')}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleLoad(id)}
                                        disabled={!record}
                                        variant="outline"
                                        title={t('saves.load')}
                                        className="h-9 flex-1 gap-[0.375rem] border-stone-600 bg-stone-900/80 px-[0.375rem] text-[16px] font-semibold text-amber-200/90 hover:bg-stone-800 hover:text-amber-300 disabled:opacity-30"
                                    >
                                        <Download className="size-[1.125rem]" />
                                        {t('saves.load')}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleDelete(id)}
                                        disabled={!record}
                                        variant="outline"
                                        title={t('saves.delete')}
                                        aria-label={t('saves.delete')}
                                        className="size-9 border-stone-700 bg-stone-900/80 p-0 text-stone-400 hover:bg-red-900/60 hover:text-red-300 disabled:opacity-30"
                                    >
                                        <Trash2 className="size-[1.125rem]" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-[0.375rem]">
                    <Button
                        type="button"
                        onClick={handleExport}
                        variant="outline"
                        className="h-9 flex-1 border-stone-700 bg-stone-900/80 px-[0.375rem] text-[16px] font-semibold text-stone-300 hover:bg-stone-800 hover:text-amber-300"
                    >
                        <Upload className="size-[1.125rem]" />
                        {t('saves.export_')}
                    </Button>
                    <label className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-[0.375rem] rounded border border-stone-700 bg-stone-900/80 px-[0.375rem] text-[16px] font-semibold text-stone-300 hover:bg-stone-800 hover:text-amber-300">
                        <Download className="size-3" />
                        {t('saves.import_')}
                        <input
                            type="file"
                            accept="application/json,.json"
                            onChange={handleImport}
                            className="hidden"
                        />
                    </label>
                </div>

                <div className="flex items-center justify-between text-[15px] tracking-wider text-stone-500 uppercase">
                    <span>{notice ?? t('saves.hint')}</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-stone-400 hover:text-amber-300"
                    >
                        {t('saves.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}