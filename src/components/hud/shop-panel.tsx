/**
 * src/components/hud/shop-panel.tsx
 * --------------------------------------------------------------------------
 * The tavern shop — spends kill-bounty money on the character's four
 * upgrade ladders, the hotbar weapons' damage ladders, and an ammo refill.
 *
 * Mounted only while the mysterious merchant is standing on the junction of
 * a four-block world (`merchantReady`): the shop moved out of the seaside
 * pavilion and onto her. Clicking her in the scene emits
 * `merchant-open-shop`, which opens this panel — the toggle button below is
 * the keyboard-free fallback for the same thing.
 *
 * ── Where the prices come from ─────────────────────────────────────────
 * Not from this file and not from the store. Each character's and each
 * weapon's YAML carries its own `upgrades:` ladder, and the store keeps
 * only the ledgers (`upgradeLevels`, `weaponLevels`). So this component
 * fetches the specs it needs, asks the pure pricing helpers what the next
 * level costs, and pays through `spendMoney()` — which refuses rather than
 * going negative. An upgrade added in YAML appears here with no code
 * change (give it a `shop.upgrade.<id>` catalog entry to get a name).
 *
 * ── Why the ammo refill lives here too ─────────────────────────────────
 * Refilling writes the store's `slots`, and the live weapon picks the new
 * ammo up when the next scene restores its slots from the store
 * (`weapons/logic.ts`). So the refill is real without reaching into the
 * Phaser weapon controller — the same "let the existing restore path do
 * the work" trick the upgrades use.
 */
import { useEffect, useMemo, useState } from 'react';
import { Coins, Home, X } from 'lucide-react';

import { CornerPixels, RETRO_BOX } from './retro-box';
import {
    SHOP_RESTORE_VITALS_EVENT,
    SHOP_RESTORE_VITALS_PRICE,
    canBuyRestore,
} from '@/lib/characters/vitals';
import { EventBus } from '@/lib/events/bus';
import { MERCHANT_SHOP_EVENT, RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import type { CharacterSpec } from '@/lib/characters';
import { fetchCharacter } from '@/lib/characters';
import { upgradeCost } from '@/lib/characters/upgrades';
import type { WeaponSpec } from '@/lib/weapons';
import { fetchWeapon } from '@/lib/weapons';
import { ammoRefillPrice, maxWeaponUpgradeLevel, weaponUpgradeCost } from '@/lib/weapons/upgrades';
import { t, pickText } from '@/locales';
import { useGameStore } from '@/store/game-store';

interface Row {
    id: string;
    name: string;
    level: number;
    max: number;
    /** null once the ladder is maxed. */
    price: number | null;
    affordable: boolean;
}

export function ShopPanel() {
    const [open, setOpen] = useState(false);
    const [spec, setSpec] = useState<CharacterSpec | null>(null);
    const [weaponSpecs, setWeaponSpecs] = useState<Record<string, WeaponSpec>>({});

    const money = useGameStore((s) => s.money);
    const characterId = useGameStore((s) => s.selectedCharacterId);
    const upgradeLevels = useGameStore((s) => s.upgradeLevels);
    const weaponLevels = useGameStore((s) => s.weaponLevels);
    const slots = useGameStore((s) => s.slots);
    const hp = useGameStore((s) => s.hp);
    const maxHp = useGameStore((s) => s.maxHp);
    const sp = useGameStore((s) => s.sp);
    const maxSp = useGameStore((s) => s.maxSp);
    const spendMoney = useGameStore((s) => s.spendMoney);
    const setUpgradeLevel = useGameStore((s) => s.setUpgradeLevel);
    const setWeaponLevel = useGameStore((s) => s.setWeaponLevel);
    const refillAmmo = useGameStore((s) => s.refillAmmo);
    // Subscribed (not read) so the labels re-render on a language switch:
    // `t()` reads module state, which React cannot see change on its own.
    const locale = useGameStore((s) => s.locale);

    // Clicking the merchant in the scene opens the shop — that click is what
    // used to be the tavern's job.
    useEffect(() => {
        const handler = () => setOpen(true);
        EventBus.on(MERCHANT_SHOP_EVENT, handler);
        return () => EventBus.off(MERCHANT_SHOP_EVENT, handler);
    }, []);

    useEffect(() => {
        if (!characterId) {
            setSpec(null);
            return;
        }
        let alive = true;
        fetchCharacter(characterId)
            .then((next) => {
                if (alive) setSpec(next);
            })
            .catch(() => {
                if (alive) setSpec(null);
            });
        return () => {
            alive = false;
        };
    }, [characterId]);

    // Slot ids as a stable string so the effect only refires when the set of
    // held weapons actually changes (the slots array is rewritten on the
    // 1Hz save tick, which would otherwise re-fetch every second).
    const slotKey = useMemo(() => [...new Set(slots.map((s) => s.id))].sort().join(','), [slots]);

    useEffect(() => {
        const ids = slotKey ? slotKey.split(',') : [];
        if (ids.length === 0) {
            setWeaponSpecs({});
            return;
        }
        let alive = true;
        Promise.all(ids.map(async (id) => [id, await fetchWeapon(id)] as const))
            .then((entries) => {
                if (alive) setWeaponSpecs(Object.fromEntries(entries));
            })
            .catch(() => {
                if (alive) setWeaponSpecs({});
            });
        return () => {
            alive = false;
        };
    }, [slotKey]);

    const rows = useMemo<Row[]>(() => {
        if (!spec?.upgrades) return [];
        return Object.keys(spec.upgrades).map((id) => {
            const max = spec.upgrades?.[id].costs.length ?? 0;
            const level = upgradeLevels[id] ?? 0;
            const price = upgradeCost(spec, id, level);
            const label = t(`shop.upgrade.${id}`);
            return {
                id,
                // An id with no catalog entry shows itself rather than a
                // raw dot-path key.
                name: label === `shop.upgrade.${id}` ? id : label,
                level,
                max,
                price,
                affordable: price !== null && money >= price,
            };
        });
        // `locale` is a real dependency: the labels come from the catalog
        // the locale selects.
    }, [spec, upgradeLevels, money, locale]);

    const weaponRows = useMemo<Row[]>(() => {
        return Object.entries(weaponSpecs)
            .filter(([, weapon]) => weapon.upgrades !== undefined)
            .map(([id, weapon]) => {
                const max = maxWeaponUpgradeLevel(weapon);
                const level = weaponLevels[id] ?? 0;
                const price = weaponUpgradeCost(weapon, level);
                return {
                    id,
                    // `name` is the code-side identity; the player reads the
                    // name of the language they are playing in.
                    name: pickText(weapon.name, weapon.nameZh),
                    level,
                    max,
                    price,
                    affordable: price !== null && money >= price,
                };
            });
        // `locale` is a real dependency: the names above follow it.
    }, [weaponSpecs, weaponLevels, money, locale]);

    const refillPrice = ammoRefillPrice(slots);
    const canRefill = refillPrice > 0 && money >= refillPrice;

    const buyUpgrade = (id: string) => {
        if (!spec) return;
        const level = upgradeLevels[id] ?? 0;
        const price = upgradeCost(spec, id, level);
        if (price === null) return;
        // Money first: if the wallet refuses, no level gets recorded.
        if (spendMoney(price)) setUpgradeLevel(id, level + 1);
    };

    const buyWeapon = (id: string) => {
        const weapon = weaponSpecs[id];
        if (!weapon) return;
        const level = weaponLevels[id] ?? 0;
        const price = weaponUpgradeCost(weapon, level);
        if (price === null) return;
        if (spendMoney(price)) setWeaponLevel(id, level + 1);
    };

    const buyRefill = () => {
        if (!canRefill) return;
        if (spendMoney(refillPrice)) refillAmmo();
    };

    // HP and SP never regenerate on their own any more — this purchase (and
    // pickups) is the only way back up. The character applies it; the panel
    // only charges and announces.
    const canRestoreVitals = canBuyRestore({ hp, maxHp, sp, maxSp, money });
    const buyVitals = () => {
        if (!canRestoreVitals) return;
        if (spendMoney(SHOP_RESTORE_VITALS_PRICE)) {
            EventBus.emit(SHOP_RESTORE_VITALS_EVENT);
        }
    };

    const rowClass =
        'flex items-center justify-between gap-2 border-b border-stone-800/60 py-1.5 last:border-0';
    const buyClass = (affordable: boolean) =>
        `flex items-center gap-1 border px-1.5 py-0.5 text-[10px] tabular-nums ${
            affordable
                ? 'border-amber-700 text-amber-300 hover:bg-amber-900/40'
                : 'cursor-not-allowed border-stone-800 text-stone-600'
        }`;

    return (
        open && (
            <div
                data-testid="shop-panel"
                className="absolute bottom-16 left-1/2 z-30 max-h-[70vh] w-[300px] -translate-x-1/2 overflow-y-auto pointer-events-auto select-none"
            >
                <div className={`relative ${RETRO_BOX} p-3 font-['Silkscreen',monospace]`}>
                    <CornerPixels />

                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-widest text-amber-300">
                            {t('shop.title')}
                        </span>
                        <div className="flex items-center gap-2">
                            <span
                                data-testid="shop-balance"
                                className="flex items-center gap-1 text-[11px] tabular-nums text-amber-300"
                            >
                                <Coins className="size-3 text-amber-400" />
                                {money}
                            </span>
                            <button
                                type="button"
                                data-testid="shop-close"
                                onClick={() => setOpen(false)}
                                aria-label={t('shop.close')}
                                className="text-stone-400 hover:text-stone-200"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    </div>

                    {!characterId ? (
                        <p data-testid="shop-hint" className="text-[11px] text-stone-400">
                            {t('shop.noCharacter')}
                        </p>
                    ) : (
                        rows.map((row) => (
                            <div
                                key={row.id}
                                data-testid={`shop-row-${row.id}`}
                                className={rowClass}
                            >
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[12px] text-stone-200">{row.name}</span>
                                    <span
                                        data-testid={`shop-level-${row.id}`}
                                        className="text-[10px] text-stone-500"
                                    >
                                        {t('shop.level')} {row.level}/{row.max}
                                    </span>
                                </div>

                                {row.price === null ? (
                                    <span
                                        data-testid={`shop-maxed-${row.id}`}
                                        className="text-[10px] text-amber-500"
                                    >
                                        {t('shop.maxed')}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        data-testid={`shop-buy-${row.id}`}
                                        disabled={!row.affordable}
                                        onClick={() => buyUpgrade(row.id)}
                                        className={buyClass(row.affordable)}
                                    >
                                        <Coins className="size-2.5" />
                                        {row.price}
                                    </button>
                                )}
                            </div>
                        ))
                    )}

                    {characterId && (
                        <>
                            <div className="mt-3 mb-1 text-[11px] uppercase tracking-widest text-amber-500/80">
                                {t('shop.weapons')}
                            </div>

                            {weaponRows.length === 0 ? (
                                <p
                                    data-testid="shop-weapons-empty"
                                    className="text-[11px] text-stone-400"
                                >
                                    {t('shop.empty')}
                                </p>
                            ) : (
                                weaponRows.map((row) => (
                                    <div
                                        key={row.id}
                                        data-testid={`shop-weapon-row-${row.id}`}
                                        className={rowClass}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[12px] text-stone-200">
                                                {row.name}
                                            </span>
                                            <span
                                                data-testid={`shop-weapon-level-${row.id}`}
                                                className="text-[10px] text-stone-500"
                                            >
                                                {t('shop.level')} {row.level}/{row.max}
                                            </span>
                                        </div>

                                        {row.price === null ? (
                                            <span
                                                data-testid={`shop-weapon-maxed-${row.id}`}
                                                className="text-[10px] text-amber-500"
                                            >
                                                {t('shop.maxed')}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                data-testid={`shop-weapon-buy-${row.id}`}
                                                disabled={!row.affordable}
                                                onClick={() => buyWeapon(row.id)}
                                                className={buyClass(row.affordable)}
                                            >
                                                <Coins className="size-2.5" />
                                                {row.price}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}

                            {slots.length > 0 && (
                                <div data-testid="shop-refill-row" className={rowClass}>
                                    <span className="text-[12px] text-stone-200">
                                        {t('shop.ammo')}
                                    </span>
                                    <button
                                        type="button"
                                        data-testid="shop-refill"
                                        disabled={!canRefill}
                                        onClick={buyRefill}
                                        className={buyClass(canRefill)}
                                    >
                                        <Coins className="size-2.5" />
                                        {refillPrice}
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* No passive HP/SP regen exists, so this is the only
                        deliberate refill outside a ground pickup. */}
                    <div data-testid="shop-vitals-row" className={rowClass}>
                        <span className="text-[12px] text-stone-200">
                            {t('shop.restoreVitals')}
                        </span>
                        <button
                            type="button"
                            data-testid="shop-restore-vitals"
                            disabled={!canRestoreVitals}
                            onClick={buyVitals}
                            className={buyClass(canRestoreVitals)}
                        >
                            <Coins className="size-2.5" />
                            {SHOP_RESTORE_VITALS_PRICE}
                        </button>
                    </div>

                    {/* The way home. Deliberately NOT `restartAtTavern`: that
                        wipes the run and drops the player back into character
                        select. This only walks them to the pavilion with
                        everything they are carrying. */}
                    <button
                        type="button"
                        data-testid="shop-return-home"
                        onClick={() => EventBus.emit(RETURN_TO_PAVILION_EVENT)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 border border-amber-700 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300 hover:bg-amber-900/40"
                    >
                        <Home className="size-3" />
                        {t('shop.returnHome')}
                    </button>
                </div>
            </div>
        )
    );
}
