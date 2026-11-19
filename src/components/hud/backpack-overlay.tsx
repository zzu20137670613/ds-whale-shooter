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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { INVENTORY_COLUMNS, INVENTORY_SLOTS, INVENTORY_STACK_MAX } from '@/lib/inventory';
import { MOBILE_BAG_SCALE, bagScale } from '@/lib/hud/mobile-layout';
import { INVENTORY_USE_EVENT } from '@/lib/inventory/events';
import { MUSIC_PAUSE, MUSIC_RESUME, KEY_BACKPACK } from '@/lib/constants';
import { BACKPACK_TOGGLE_EVENT } from '@/lib/constants';
import { isMobileLike } from '@/lib/mobile';
import { EventBus } from '@/lib/events/bus';
import { ignoresBackdropClick } from '@/lib/inventory/backdrop-click';
import { getPhaserGame } from '@/lib/phaser-game';
import { pickText, t } from '@/locales';
import { sortBagSlots } from '@/lib/drops/display-order';
import { buildCodexRows } from '@/lib/drops/codex';
import { BackpackCodex } from './backpack-codex';
import { useGameStore } from '@/store/game-store';

import { DropIcon } from './drop-icon';
import { CornerPixels, RETRO_BOX } from './retro-box';

/**
 * One font for every item label.
 *
 * The panel sets `font-['Silkscreen',monospace]`, a pixel font with no CJK glyphs, so each
 * Chinese character fell back to whatever the OS picked — at 9 px that read as a smudge
 * (`背包里道具的字体看不起`). An explicit CJK stack renders every label with the same face,
 * the same weight and one size bigger than before.
 */
const ITEM_LABEL_FONT =
    "font-['Microsoft_YaHei','PingFang_SC','Noto_Sans_SC',sans-serif] font-bold leading-tight";

export function BackpackOverlay() {
    const open = useGameStore((s) => s.backpackOpen);
    const setOpen = useGameStore((s) => s.setBackpackOpen);
    const inventory = useGameStore((s) => s.inventory);
    const catalog = useGameStore((s) => s.dropCatalog);
    // locale is subscribed so a language switch re-renders the labels.
    useGameStore((s) => s.locale);

    const paused = useRef<Phaser.Scene | null>(null);
    /**
     * When the overlay appeared.
     *
     * The chip that opens it is under the backdrop, so the tap's `click` lands on the backdrop
     * the instant the overlay exists - open, then closed within one frame, which the owner
     * reported as `点了闪一下就没了`. Any backdrop click inside this window is the opening tap,
     * not a dismissal.
     */
    const openedAt = useRef(0);
    /**
     * 手机端背包缩放。
     *
     * 主人 2026-11-13：`背包打开直接超出屏幕高度了，将手机端的背包高度等比缩小1/5（宽度什么的
     * 一起等比缩小）`。目标就是 0.8，但缩完还超就是同一个 bug 换了字号，所以再按可用高度封顶。
     */
    const mobile = isMobileLike();
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelScale, setPanelScale] = useState(mobile ? MOBILE_BAG_SCALE : 1);
    // `open` is read inside the key handler; a ref keeps the listener stable.
    const openRef = useRef(open);
    openRef.current = open;

    function pauseGame() {
        const scene = getPhaserGame()?.scene.getScenes(true)[0] ?? null;
        scene?.scene.pause();
        paused.current = scene;
        EventBus.emit(MUSIC_PAUSE);
        openedAt.current = performance.now();
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
            // Both keys toggle, in either case (Shift+letter or caps lock must not matter).
            if (KEY_BACKPACK.includes(e.key.toLowerCase())) {
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

    // The touch chip asks through the bus, so pause/resume lives only here.
    useEffect(() => {
        const onToggle = () => {
            if (openRef.current) resumeGame();
            else pauseGame();
        };
        EventBus.on(BACKPACK_TOGGLE_EVENT, onToggle);
        return () => EventBus.off(BACKPACK_TOGGLE_EVENT, onToggle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 量一次面板的原始高度（transform 不影响 offsetHeight），再换算成能放下的缩放。
    useLayoutEffect(() => {
        if (!open || !mobile) return;
        const measure = (): void => {
            const panel = panelRef.current;
            const host = overlayRef.current;
            if (!panel || !host) return;
            setPanelScale(bagScale(panel.offsetHeight, host.clientHeight, true));
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(measure);
        if (panelRef.current) ro.observe(panelRef.current);
        if (overlayRef.current) ro.observe(overlayRef.current);
        return () => ro.disconnect();
    }, [open, mobile]);

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
        // Say so, instead of swallowing the click: a material that does nothing is
        // indistinguishable from a broken control.
        if (entry && !entry.usable) {
            // 物品自带解释就用它的（饭盆：未至之境的关键道具），否则用通用那句。
            const notice = entry.unusableNotice
                ? pickText(entry.unusableNotice, entry.unusableNoticeZh)
                : t('backpack.cannotUse');
            useGameStore.getState().showNotice(notice);
            return;
        }
        EventBus.emit(INVENTORY_USE_EVENT, { index });
    };

    // Drop ids that are in the bag but absent from the catalog (no name, no art).
    const missing = Array.from(
        new Set(inventory.filter((s) => s && !catalog[s.dropId]).map((s) => s.dropId)),
    );

    // 60 格，但**画出来的顺序**按主人 2026-11-15 定的名单走（生命碎片 → 白米饭），
    // 名单外的排在后面。`index` 保留原始槽位下标 —— 点格子时用的还是它。
    const ranked = sortBagSlots(inventory);
    const cells = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ranked[i] ?? null);

    // 图鉴：目录里的东西，顺序和背包一致，武器那行不给（`lib/drops/codex.ts`）。
    const codexRows = buildCodexRows(catalog);

    return (
        <div
            ref={overlayRef}
            className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/70 select-none overflow-hidden"
            data-testid="backpack-overlay"
            onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                if (ignoresBackdropClick(openedAt.current, performance.now())) return;
                resumeGame();
            }}
        >
            <div
                ref={panelRef}
                data-bag-panel
                className={`${RETRO_BOX} relative p-4 font-['Silkscreen',monospace]`}
                style={
                    mobile
                        ? {
                              transform: `scale(${panelScale})`,
                              transformOrigin: 'center center',
                              flexShrink: 0,
                          }
                        : undefined
                }
            >
                <CornerPixels />
                <div className="mb-3 flex items-center justify-between gap-6 border-b-2 border-amber-900/60 pb-2">
                    <span className="text-sm font-bold tracking-wider text-amber-200 uppercase drop-shadow-[1px_1px_0px_#000]">
                        {t('backpack.title')}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-stone-400">
                            {isMobileLike() ? t('backpack.hintTouch') : t('backpack.hint')}
                        </span>
                        <button
                            type="button"
                            onClick={resumeGame}
                            aria-label={t('backpack.close')}
                            title={t('backpack.close')}
                            className="-mr-1 flex size-6 items-center justify-center border border-stone-600 bg-stone-900 text-[13px] leading-none text-stone-300 transition-colors hover:border-amber-600 hover:text-amber-300"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div
                    data-bag-grid
                    className="grid gap-1"
                    // 56 px cells, not 44: at 44 a four-character label (生命碎片) had 40 px to
                    // live in and was clipped, which is the owner's
                    // `让四个字的道具名字显示全`. Four 11 px characters need 44 px, so the cell
                    // carries them with room for the count badge.
                    style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, 3.5rem)` }}
                >
                    {cells.map((cell, cellIndex) => {
                        const slot = cell?.slot ?? null;
                        const index = cell?.index ?? -1;
                        const entry = slot ? catalog[slot.dropId] : undefined;
                        const usable = entry?.usable ?? false;
                        const label = entry ? pickText(entry.name, entry.nameZh) : '';
                        return (
                            <button
                                key={cell ? `${cell.slot.dropId}:${cell.index}` : `empty-${cellIndex}`}
                                type="button"
                                disabled={!slot}
                                title={
                                    slot
                                        ? `${label}${usable ? '' : ` · ${t('backpack.material')}`}`
                                        : ''
                                }
                                onClick={() => useSlot(index)}
                                data-bag-cell
                                className={`relative flex size-14 flex-col items-center justify-center border text-[9px] leading-tight ${
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
                                            were about to drink.

                                            Weapons never reach this list - a weapon
                                            pickup goes straight to the hotbar - so the
                                            fallback below only guards a future drop that
                                            ships without a sprite block. Every drop that
                                            can enter the bag today has art. */}
                                        <DropIcon
                                            icon={entry.icon}
                                            tint={entry.tint}
                                            label={label}
                                        />

                                        <span
                                            data-item-label
                                            className={`mt-0.5 max-w-full whitespace-nowrap px-0.5 text-[11px] ${ITEM_LABEL_FONT}`}
                                        >
                                            {label}
                                        </span>
                                        {slot.count > 1 && (
                                            <span
                                                data-slot-count
                                                className="absolute top-0 right-0 bg-black/80 px-0.5 text-[10px] leading-none text-amber-300"
                                            >
                                                ×{slot.count}
                                            </span>
                                        )}
                                    </>
                                ) : slot ? (
                                    /* The item is in the bag but the catalog has no entry for
                                       it, so there is nothing to draw. Scream the id instead of
                                       leaving a blank cell that reads like a rendering bug. */
                                    <span
                                        className={`px-0.5 text-center text-[10px] break-all text-rose-400 ${ITEM_LABEL_FONT}`}
                                    >
                                        {slot.dropId}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>

                {typeof window !== 'undefined' && window.location.search.includes('bagDebug') && (
                    <div className="mt-1 border border-lime-700 bg-black/85 px-1 py-0.5 font-mono text-[10px] leading-tight text-lime-300">
                        inventory={inventory.length} catalog={Object.keys(catalog).length}{' '}
                        {inventory.map((s, i) => {
                            const e = catalog[s.dropId];
                            return (
                                <span key={i}>
                                    [{s.dropId}×{s.count}
                                    {e ? '' : ' NO-ENTRY'}
                                    {e?.icon ? '' : ' NO-ICON'}]
                                </span>
                            );
                        })}
                    </div>
                )}
                {missing.length > 0 && (
                    <div className="mt-1 border border-rose-800 bg-black/85 px-1 py-0.5 font-mono text-[10px] leading-tight text-rose-300">
                        目录缺失: {missing.join(' / ')}
                    </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-800 pt-1 text-[11px] text-stone-400">
                    <span>
                        {inventory.length === 0
                            ? t('backpack.empty')
                            : `${t('backpack.count')} ${inventory.reduce((n, s) => n + s.count, 0)} / ${
                                  INVENTORY_SLOTS * INVENTORY_STACK_MAX
                              }`}
                    </span>

                    {/* 图鉴：悬停看，点一下也看（手机没有悬停）。样式照抄词元盾那个弹框。 */}
                    <BackpackCodex
                        rows={codexRows.map((row) => ({
                            id: row.id,
                            label: pickText(row.name, row.nameZh),
                            effect: pickText(row.effectEn, row.effectZh),
                        }))}
                        emptyText={t('backpack.codexEmpty')}
                        titleText={t('backpack.codexTitle')}
                        buttonText={t('backpack.codex')}
                    />
                </div>
            </div>
        </div>
    );
}
