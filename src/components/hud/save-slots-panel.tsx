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
import { Download, Save, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPhaserGame, resolveAndRestart } from '@/lib/phaser-game';
import {
    QUICK_SLOT_ID,
    SAVE_SLOT_IDS,
    formatPlaytime,
    formatSavedAt,
    slotLabel,
    type SaveSlotId,
    type SaveSlotRecord,
} from '@/lib/saves/slots';
import { t } from '@/locales';
import { useGameStore } from '@/store/game-store';

import { CornerPixels, RETRO_BOX } from './retro-box';

/** A small JPEG of the running scene, or undefined when the canvas cannot be read. */
function captureThumbnail(): string | undefined {
    try {
        const canvas = getPhaserGame()?.canvas;
        if (!canvas) return undefined;
        // Half scale keeps a card-sized image around 20-40 KB in localStorage.
        const thumb = document.createElement('canvas');
        thumb.width = 160;
        thumb.height = 90;
        const ctx = thumb.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
        return thumb.toDataURL('image/jpeg', 0.6);
    } catch {
        // Tainted canvas or a lost context: the slot is still worth saving.
        return undefined;
    }
}

interface SaveSlotsPanelProps {
    onClose: () => void;
}

export function SaveSlotsPanel({ onClose }: SaveSlotsPanelProps) {
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

    const ids = useMemo<SaveSlotId[]>(() => [...SAVE_SLOT_IDS, QUICK_SLOT_ID], []);

    function handleSave(id: SaveSlotId) {
        const existing = slots[id];
        if (existing && pendingOverwrite !== id) {
            setPendingOverwrite(id);
            setNotice(null);
            return;
        }
        const record = saveToSlot(id, captureThumbnail());
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
        // The store now holds the slot's state; restarting the saved level is what
        // actually puts the player back in it.
        onClose();
        void resolveAndRestart(record.levelId);
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
                className={`${RETRO_BOX} relative flex w-[30rem] flex-col gap-3 px-5 py-4 font-['Silkscreen',monospace]`}
            >
                <CornerPixels />
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-2 right-2 text-stone-500 transition-colors hover:text-amber-400"
                >
                    <X className="size-5" />
                </button>

                <div className="flex items-center gap-2">
                    <span className="h-px flex-1 bg-amber-800/50" />
                    <span className="text-xs font-bold tracking-[0.3em] text-amber-400 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {t('saves.title')}
                    </span>
                    <span className="h-px flex-1 bg-amber-800/50" />
                </div>

                <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {ids.map((id) => {
                        const record: SaveSlotRecord | null = slots[id];
                        const confirming = pendingOverwrite === id;
                        return (
                            <div
                                key={String(id)}
                                className="flex flex-col gap-1.5 rounded border border-stone-700/80 bg-stone-900/70 p-2"
                            >
                                <div className="flex items-center justify-between text-[10px] tracking-widest text-stone-400 uppercase">
                                    <span>{slotLabel(id)}</span>
                                    {record && <span>{formatSavedAt(record.savedAt)}</span>}
                                </div>

                                {record?.thumbnail ? (
                                    <img
                                        src={record.thumbnail}
                                        alt=""
                                        className="h-14 w-full rounded-sm object-cover"
                                    />
                                ) : (
                                    <div className="flex h-14 w-full items-center justify-center rounded-sm border border-dashed border-stone-700 text-[10px] tracking-wider text-stone-600 uppercase">
                                        {record ? record.levelTitle : t('saves.empty')}
                                    </div>
                                )}

                                {record && (
                                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                                        <span>{formatPlaytime(record.elapsedMs)}</span>
                                        <span>{record.money} G</span>
                                    </div>
                                )}

                                <div className="mt-auto flex items-center gap-1">
                                    <Button
                                        type="button"
                                        onClick={() => handleSave(id)}
                                        title={confirming ? t('saves.overwrite') : t('saves.save')}
                                        className={`h-6 flex-1 px-1 text-[10px] font-semibold ${
                                            confirming
                                                ? 'bg-red-600 text-white hover:bg-red-500'
                                                : 'bg-amber-500 text-black hover:bg-amber-400'
                                        }`}
                                    >
                                        <Save className="size-3" />
                                        {confirming ? t('saves.overwrite') : t('saves.save')}
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleLoad(id)}
                                        disabled={!record}
                                        variant="outline"
                                        title={t('saves.load')}
                                        className="size-6 border-stone-700 bg-stone-900/80 p-0 text-stone-300 hover:bg-stone-800 hover:text-amber-300 disabled:opacity-30"
                                    >
                                        <Download className="size-3" />
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() => handleDelete(id)}
                                        disabled={!record}
                                        variant="outline"
                                        title={t('saves.delete')}
                                        className="size-6 border-stone-700 bg-stone-900/80 p-0 text-stone-400 hover:bg-red-900/60 hover:text-red-300 disabled:opacity-30"
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between text-[9px] tracking-wider text-stone-500 uppercase">
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