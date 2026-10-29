/**
 * src/components/hud/backpack-overlay.tsx
 * --------------------------------------------------------------------------
 * The backpack: 60 cells, 10 wide by 6 tall.
 *
 * Opens with B and pauses the running scene the same way the settings hub does
 * (`scene.scene.pause()`, music paused alongside), because reading a bag while
 * five barnacle parasites chew on you is not a game.
 *
 * A cell click does not apply anything itself: it emits `inventory:use` and the
 * drop controller (which owns the live character) validates, consumes and
 * applies. Materials are not clickable - they are sold, and the sell flow lands
 * in the shop.
 */

import { useEffect, useRef } from 'react';

import { INVENTORY_COLUMNS, INVENTORY_SLOTS, INVENTORY_STACK_MAX } from '@/lib/inventory';
import { INVENTORY_USE_EVENT } from '@/lib/inventory/events';
import { MUSIC_PAUSE, MUSIC_RESUME } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { getPhaserGame } from '@/lib/phaser-game';
import { pickText, t } from '@/locales';
import { useGameStore } from '@/store/game-store';

import { CornerPixels, RETRO_BOX } from './retro-box';

export function BackpackOverlay() {
    const open = useGameStore((s) => s.backpackOpen);
    const setOpen = useGameStore((s) => s.setBackpackOpen);
    const inventory = useGameStore((s) => s.inventory);
    const catalog = useGameStore((s) => s.dropCatalog);
    // locale is subscribed so a language switch re-renders the labels.
    useGameStore((s) => s.locale);

    const paused = useRef<Phaser.Scene | null>(null);
    // `open` is read inside the key handler; a ref keeps the listener stable.
    const openRef = useRef(open);
    openRef.current = open;

    function pauseGame() {
        const scene = getPhaserGame()?.scene.getScenes(true)[0] ?? null;
        scene?.scene.pause();
        paused.current = scene;
        EventBus.emit(MUSIC_PAUSE);
        setOpen(true);
    }

    function resumeGame() {
        paused.current?.scene.resume();
        paused.current = null;
        EventBus.emit(MUSIC_RESUME);
        setOpen(false);
    }

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                if (openRef.current) resumeGame();
                else pauseGame();
            } else if (e.key === 'Escape' && openRef.current) {
                resumeGame();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Closing from elsewhere (death, scene switch) must not leave the scene paused.
    useEffect(() => {
        if (!open && paused.current) {
            paused.current.scene.resume();
            paused.current = null;
        }
    }, [open]);

    if (!open) return null;

    const useSlot = (index: number) => {
        const slot = inventory[index];
        if (!slot) return;
        const entry = catalog[slot.dropId];
        if (entry && !entry.usable) return;
        EventBus.emit(INVENTORY_USE_EVENT, { index });
    };

    // 60 cells, positional: slot i draws at cell i.
    const cells = Array.from({ length: INVENTORY_SLOTS }, (_, index) => inventory[index]);

    return (
        <div
            className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/70 select-none"
            data-testid="backpack-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) resumeGame();
            }}
        >
            <div className={`${RETRO_BOX} relative p-4 font-['Silkscreen',monospace]`}>
                <CornerPixels />
                <div className="mb-3 flex items-center justify-between gap-6 border-b-2 border-amber-900/60 pb-2">
                    <span className="text-sm font-bold tracking-wider text-amber-200 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {t('backpack.title')}
                    </span>
                    <span className="text-[10px] text-stone-400">{t('backpack.hint')}</span>
                </div>

                <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, 2.75rem)` }}
                >
                    {cells.map((slot, index) => {
                        const entry = slot ? catalog[slot.dropId] : undefined;
                        const usable = entry?.usable ?? false;
                        const label = entry ? pickText(entry.name, entry.nameZh) : '';
                        return (
                            <button
                                key={index}
                                type="button"
                                disabled={!slot}
                                title={
                                    slot
                                        ? `${label}${usable ? '' : ` · ${t('backpack.material')}`}`
                                        : ''
                                }
                                onClick={() => useSlot(index)}
                                className={`relative flex size-11 flex-col items-center justify-center border text-[9px] leading-tight ${
                                    slot
                                        ? usable
                                            ? 'border-amber-700 bg-stone-900 text-amber-100 hover:bg-stone-800'
                                            : 'border-stone-700 bg-stone-950 text-stone-400'
                                        : 'border-stone-800 bg-black/40 text-transparent'
                                }`}
                                style={
                                    entry
                                        ? {
                                              boxShadow: `inset 0 0 0 1px #000, 0 0 6px -2px #${entry.tint
                                                  .toString(16)
                                                  .padStart(6, '0')}`,
                                          }
                                        : undefined
                                }
                            >
                                {slot && entry ? (
                                    <>
                                        {/* The item's own art, cropped out of its sheet.
                                            A colour chip told you nothing about what you
                                            were about to drink. */}
                                        {entry.icon ? (
                                            <span
                                                aria-hidden
                                                className="size-6 bg-no-repeat"
                                                style={{
                                                    backgroundImage: `url(${entry.icon.path})`,
                                                    backgroundSize: `${entry.icon.cols * 100}% ${entry.icon.rows * 100}%`,
                                                    backgroundPosition: `${
                                                        entry.icon.cols > 1
                                                            ? (entry.icon.frame % entry.icon.cols) * 100
                                                            : 0
                                                    }% ${
                                                        entry.icon.cols > 1 && entry.icon.rows > 1
                                                            ? Math.floor(entry.icon.frame / entry.icon.cols) * 100
                                                            : 0
                                                    }%`,
                                                    imageRendering: 'pixelated',
                                                }}
                                            />
                                        ) : (
                                            <span
                                                className="size-3 border border-black/60"
                                                style={{
                                                    backgroundColor: `#${entry.tint
                                                        .toString(16)
                                                        .padStart(6, '0')}`,
                                                }}
                                            />
                                        )}
                                        <span className="mt-0.5 max-w-full truncate px-0.5">
                                            {label}
                                        </span>
                                        {slot.count > 1 && (
                                            <span className="absolute right-0 bottom-0 bg-black/80 px-0.5 text-[8px] text-amber-300">
                                                ×{slot.count}
                                            </span>
                                        )}
                                    </>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-2 border-t border-stone-800 pt-1 text-[9px] text-stone-500">
                    {inventory.length === 0
                        ? t('backpack.empty')
                        : `${t('backpack.count')} ${inventory.reduce((n, s) => n + s.count, 0)} / ${
                              INVENTORY_SLOTS * INVENTORY_STACK_MAX
                          }`}
                </div>
            </div>
        </div>
    );
}
