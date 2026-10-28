import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { setLocale as setLocaleRuntime, type LocaleCode } from '@/locales';
import {
    QUICK_SLOT_ID,
    SAVE_SLOT_IDS,
    SLOT_RECORD_VERSION,
    isSaveSlotRecord,
    saveSlotKey,
    type SaveSlotId,
    type SaveSlotRecord,
} from '@/lib/saves/slots';
import { reserveMaxFor } from '@/lib/weapons/ammo';
import { addToInventory, emptyInventory, removeFromInventory } from '@/lib/inventory';
import { bagSellValue } from '@/lib/inventory/sell';
import type { InventorySlot } from '@/lib/inventory';
import type { PetBonus } from '@/lib/pet/lifetime';

export interface WeaponSlotData {
    id: string;
    name: string;
    ammo: number;
    /** Spare rounds behind the magazine; the weapon card's right-hand number. */
    reserve?: number;
    clipSize: number;
    /** Public-path URL for the weapon thumbnail (e.g. `/assets/image/weapons/arcana-staff.png`).
     *  Undefined for melee weapons or spec.visual entries without a texture. */
    texture?: string;
}

/** What the backpack UI needs to draw one kind of item. */
export interface DropCatalogEntry {
    name: string;
    nameZh?: string;
    /** `material` items cannot be used, only sold. */
    usable: boolean;
    /** Coins per unit when sold; 0 for items the shop will not buy yet. */
    sellPrice: number;
    /** The colour the drop drew itself with; the bag draws a block of it. */
    tint: number;
}

export interface LevelWaveProgress {
    currentWaveIndex: number;
    clearedWaveIds: string[];
}

export interface PlayerSnapshot {
    x: number;
    y: number;
}

export interface MonsterEntitySnapshot {
    specId: string;
    hp: number;
    x: number;
    y: number;
    waveId?: string;
    spawnIndex?: number;
}

export interface MonsterSystemSnapshot {
    activeMonsters: MonsterEntitySnapshot[];
    pendingSpawnIndices: number[];
}

export interface DropEntitySnapshot {
    specId: string;
    x: number;
    y: number;
    /** When this drop is a weapon pickup, the resolved weapon id is
     *  recorded so the drop's in-hand texture can be restored on
     *  refresh. Undefined for non-weapon drops (heal / ammo / etc.). */
    weaponId?: string;
}

export interface GameUIState {
    // Character Status
    characterName: string;
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;

    // Weapon Status
    activeWeaponIndex: number;
    activeWeaponName: string;
    activeAmmo: number;
    activeMaxAmmo: number;
    isReloading: boolean;
    reloadProgress: number; // 0 to 1
    slots: WeaponSlotData[];

    // Level & Save Status
    levelTitle: string;
    currentLevelId: string;
    /** Map of levelId -> wave progress, allowing independent per-level wave tracking. */
    levelProgressMap: Record<string, LevelWaveProgress>;
    /** Elapsed milliseconds since the current level started. Driven by
     *  the scene's update() loop; HUDs read it to display MM:SS. */
    levelElapsedMs: number;

    /**
     * Title key the shop panel renders. Transient: the cat in the developer's
     * cabin opens the very same shop under its own name (猫猫商店).
     */
    shopTitleKey: 'shop.title' | 'shop.catTitle';
    /** Persisted: the cat's gift rifle is once per save. */
    catShopGiftGiven: boolean;
    setShopTitle: (key: 'shop.title' | 'shop.catTitle') => void;
    /**
     * Open the shop from the cat. Returns true on the FIRST call of a save, which
     * is when the gift rifle is due. Persisted, so the gift is once per run.
     */
    openCatShop: () => boolean;
    /**
     * Merge a weapon the character already owns into one: +1 level (capped by the
     * ladder) and a full magazine plus reserve. Returns true when a slot matched.
     */
    mergeOwnedWeapon: (weaponId: string, maxLevel: number) => boolean;
    /** Transient, never persisted: the mysterious merchant is standing on the
     *  current level, so her shop is available. The scene sets it when she
     *  appears (all monsters cleared) and clears it on teardown. */
    merchantReady: boolean;

    // Economy — the tavern shop's currency. Earned as a per-monster
    // bounty (`monsters/monster.ts` → `kill()`) and spent in the tavern.
    // Persisted, so a purchase survives a refresh. Wiped by clearSaveData
    // along with the rest of the run — death is a full reset, not a bank.
    money: number;

    /**
     * The backpack. 60 slots, the same item stacking to 30 per slot, filled by
     * walking over a drop. Persisted with the run.
     */
    inventory: InventorySlot[];

    /**
     * Display data for every drop id the scene loaded, so the backpack can name
     * an item it holds. Rebuilt on scene boot, never persisted (it is data, not
     * progress).
     */
    dropCatalog: Record<string, DropCatalogEntry>;

    /** Backpack overlay visibility. The overlay pauses the scene itself. */
    backpackOpen: boolean;

    /**
     * Quadrants whose follow-spawn wave has already fired, keyed `levelId:index`.
     * Persisted: a reload must not hand the player another free wave to farm.
     */
    spawnedRegions: string[];

    // Tavern upgrades — how many levels of each upgrade the player has
    // bought this run, keyed by upgrade id (see `characters/*.yaml` →
    // `upgrades:`). The prices and the stat effects live in that YAML;
    // this is only the ledger. Persisted.
    upgradeLevels: Record<string, number>;

    // Weapon upgrades — how many levels are bought per weapon, keyed by
    // weapon id. A separate ledger from `upgradeLevels`: those are keyed by
    // character upgrade id, and a weapon id could collide with one.
    weaponLevels: Record<string, number>;

    // Language — which catalog `t()` reads, and which sibling `pickText()`
    // prefers for game data. Persisted; mirrored into the i18n runtime.
    /**
     * Which half of the input redesign is live.
     *
     *   'mouse'       the cursor aims, manually (the magnet is gone either way)
     *   'directional' the arrow keys aim, eight ways
     *
     * Persisted: a player who aims with arrows should not re-pick it every reload.
     */
    inputScheme: InputScheme;

    /** Switch schemes. Called by the HUD corner chip and by the settings page. */
    setInputScheme: (scheme: InputScheme) => void;

    locale: LocaleCode;

    /**
     * The desktop pet's buff for this page load, or null before the bridge has
     * answered. `percent` is what her panel multiplies by - never assume 50, it
     * is the pet's own tier now (see `@/lib/pet/bridge`).
     */
    petBonus: PetBonus | null;

    // Entity Snapshots for Fine-Grained Mid-Combat Save/Restore
    playerSnapshot?: PlayerSnapshot;
    activeMonstersSnapshot?: MonsterSystemSnapshot;
    groundDropsSnapshot?: DropEntitySnapshot[];

    // Visibility
    hubsVisible: boolean;

    // Death state — true while the character's HP has reached 0 and
    // the scene is paused. The HUD overlays a restart prompt; the
    // Phaser scene pauses until the user clicks Restart.
    isDead: boolean;

    // Victory state — true when the final level's waves and monsters are all cleared.
    isVictory: boolean;

    // Tavern / character selection state
    /** Persisted id of the character the player selected in the tavern.
     *  null = never selected (tavern not yet completed). */
    selectedCharacterId: string | null;

    /**
     * The 34-page comic that opens the hidden level, while it is on screen.
     * Null when nothing is playing. Holds the level id so the overlay knows
     * which pages to fetch.
     */
    comicIntroLevelId: string | null;
    /** The developer cabin's computer is open on screen. */
    devCabinOpen: boolean;
    /** Levels whose comic has already played this save - replayable via 跳过. */
    comicPlayedLevels: string[];
    /** The ending sequence is running; the scene is frozen behind it. */
    settlementOpen: boolean;
    /** Run time the ending's ledger prints, in ms. */
    settlementRunMs: number;
    /**
     * Whoever the player was before the arena forced a character on them.
     * Restored when the ending sends them back to the pavilion.
     */
    characterBeforeArena: string | null;
    /** true once the player has finished the tavern (selected a character
     *  + entered the first real level). Resets on clearSaveData. */
    tavernCleared: boolean;
    /** How many weapons the player has picked up in the current tavern
     *  session. Not persisted — resets each time the tavern scene loads. */
    tavernWeaponCount: number;
    /** Props the player has shot open, keyed `level:monsterType`. Unlike the
     *  rest of the save this is world state, so `clearSaveData` keeps it: the
     *  tavern ornament must not grow back and re-hide the hidden entrance
     *  after a death or a restart. */
    brokenProps: string[];
    /** One-shot region triggers already fired this run, keyed
     *  `level:triggerId`. Unlike `brokenProps` this is run state, so
     *  `clearSaveData` wipes it and a fresh run earns the juice again. */
    usedTriggers: string[];

    // Setters
    setLevelTitle: (title: string) => void;
    setMerchantReady: (ready: boolean) => void;
    setCurrentLevelId: (levelId: string) => void;
    setWaveProgress: (levelId: string, progress: Partial<LevelWaveProgress>) => void;
    setLevelElapsedMs: (ms: number) => void;
    setEntitySnapshots: (snapshots: {
        player?: PlayerSnapshot;
        monsters?: MonsterSystemSnapshot;
        drops?: DropEntitySnapshot[];
        /** Level clock, piggybacked so a save costs one store write. */
        elapsedMs?: number;
    }) => void;
    setCharacterStats: (stats: {
        name?: string;
        hp: number;
        maxHp: number;
        sp: number;
        maxSp: number;
    }) => void;
    setWeaponStats: (stats: {
        activeIndex: number;
        name: string;
        ammo: number;
        maxAmmo: number;
        /** Spare rounds behind the active magazine. */
        reserve: number;
        isReloading: boolean;
        reloadProgress: number;
        slots: WeaponSlotData[];
    }) => void;
    setHubsVisible: (visible: boolean) => void;
    setDead: (dead: boolean) => void;
    setVictory: (victory: boolean) => void;
    /**
     * Add a bounty. Non-finite and non-positive amounts are ignored, and
     * the balance stays an integer so prices always compare cleanly.
     */
    addMoney: (amount: number) => void;
    /**
     * Put `count` units of `dropId` into the backpack. Returns how many fit; 0
     * means the bag is full and the caller must leave the drop on the floor.
     */
    addInventoryItem: (dropId: string, count: number) => number;
    /**
     * Take one unit out of the slot at `index` and return its drop id, or null
     * when the index is empty. The caller applies the effect.
     */
    consumeInventorySlot: (index: number) => string | null;
    /** Publish the drop specs the current scene loaded (names, prices, usability). */
    setDropCatalog: (entries: Record<string, DropCatalogEntry>) => void;
    setBackpackOpen: (open: boolean) => void;
    /** Record that a quadrant's wave fired. */
    markRegionSpawned: (key: string) => void;
    /**
     * Sell one unit out of the slot at `index`, paying its `sellPrice`. Returns
     * the coins earned (0 when the item has no price, so a shop row can gate on
     * it).
     */
    sellInventorySlot: (index: number) => number;
    /** Sell every sellable unit in the bag. Returns coins earned. */
    sellEverything: () => number;
    /**
     * Deduct a price if the player can afford it. Returns false and
     * changes nothing otherwise, so a shop row can gate its purchase on
     * the result instead of re-reading the balance.
     */
    spendMoney: (amount: number) => boolean;
    /**
     * Record an upgrade purchase. Pricing is the caller's job — the shop
     * has the character spec, the store only keeps the ledger.
     */
    setUpgradeLevel: (upgradeId: string, level: number) => void;
    /** Record a weapon upgrade purchase. Pricing is the caller's job. */
    setWeaponLevel: (weaponId: string, level: number) => void;
    /**
     * Top every hotbar slot back up to its clip size. The shop sells this;
     * the live weapon picks the new ammo up when the next scene restores
     * its slots from the store (`weapons/logic.ts`).
     */
    refillAmmo: () => void;
    /**
     * Fill one weapon's magazine and reserve. Buying an upgrade does this for
     * free, so the new magazine's worth of spares never arrives half empty.
     */
    refillWeaponAmmo: (weaponId: string) => void;
    /** Switch language; mirrors into the i18n runtime immediately. */
    setLocale: (code: LocaleCode) => void;
    setPetBonus: (bonus: PetBonus | null) => void;
    resetLevelProgress: (levelId: string) => void;
    /**
     * Clear per-scene entity snapshots only (player/monster/drop
     * positions). Preserves the player's hotbar, HP, SP, and
     * character choice. Used by scene transitions (teleport, Jump-
     * to-scene) so picked-up weapons survive the cut.
     */
    clearSceneSnapshots: () => void;
    clearSaveData: () => void;

    /**
     * The six-slot rack plus the quick slot, as last written.
     *
     * Read lazily from localStorage rather than mirrored into state: a slot only
     * changes when the player presses save, so caching it would just be a second
     * source of truth to keep in sync.
     */
    listSaveSlots: () => Record<SaveSlotId, SaveSlotRecord | null>;
    /** Write one slot. Returns the record written, or null if there was nothing to save. */
    saveToSlot: (id: SaveSlotId, thumbnail?: string) => SaveSlotRecord | null;
    /** Load one slot into the live store. False when the slot is empty or unreadable. */
    loadFromSlot: (id: SaveSlotId) => boolean;
    /** Remove one slot. */
    deleteSaveSlot: (id: SaveSlotId) => void;
    setSelectedCharacterId: (id: string | null) => void;
    openComicIntro: (levelId: string) => void;
    openDevCabin: () => void;
    closeDevCabin: () => void;
    closeComicIntro: () => void;
    openSettlement: (runMs: number) => void;
    closeSettlement: () => void;
    setCharacterBeforeArena: (id: string | null) => void;
    setTavernCleared: (cleared: boolean) => void;
    setTavernWeaponCount: (n: number) => void;
    /** Remember a prop as opened, so the scene stops spawning it. */
    markPropBroken: (key: string) => void;
    /** Remember a one-shot region trigger as fired for this run. */
    markTriggerUsed: (key: string) => void;
}

/**
 * Locale the game boots in. Read once from the browser so a Chinese
 * player lands in Chinese without a trip to settings; falls back to the
 * shipped English when there is no `navigator` (node test env).
 */
function detectLocale(): LocaleCode {
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    return lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

/**
 * Two ways to aim, one at a time.
 *
 *  'mouse'        the cursor is the aim
 *  'directional'  the arrow keys aim, eight ways (gamepad stick and touch walk
 *                 direction feed the same path)
 */
export type InputScheme = 'mouse' | 'directional';

export const initialGameState = {
    characterName: '',
    hp: 0,
    maxHp: 0,
    sp: 0,
    maxSp: 0,

    activeWeaponIndex: 0,
    activeWeaponName: '',
    activeAmmo: 0,
    activeMaxAmmo: 0,
    isReloading: false,
    reloadProgress: 0,
    slots: [] as WeaponSlotData[],

    levelTitle: '',
    currentLevelId: '',
    levelProgressMap: {} as Record<string, LevelWaveProgress>,
    levelElapsedMs: 0,
    merchantReady: false,
    shopTitleKey: 'shop.title' as 'shop.title' | 'shop.catTitle',
    catShopGiftGiven: false,

    money: 0,
    inventory: emptyInventory(),
    dropCatalog: {} as Record<string, DropCatalogEntry>,
    backpackOpen: false,
    spawnedRegions: [] as string[],
    // World state, not run state — `clearSaveData` deliberately keeps it.
    brokenProps: [] as string[],
    // Run state, not world state — a new run earns the trigger again.
    usedTriggers: [] as string[],

    upgradeLevels: {} as Record<string, number>,
    weaponLevels: {} as Record<string, number>,
    inputScheme: 'mouse' as InputScheme,
    locale: detectLocale(),
    petBonus: null,

    playerSnapshot: undefined as PlayerSnapshot | undefined,
    activeMonstersSnapshot: undefined as MonsterSystemSnapshot | undefined,
    groundDropsSnapshot: undefined as DropEntitySnapshot[] | undefined,

    hubsVisible: true,
    isDead: false,
    isVictory: false,

    selectedCharacterId: null as string | null,
    comicIntroLevelId: null as string | null,
    devCabinOpen: false,
    comicPlayedLevels: [] as string[],
    settlementOpen: false,
    settlementRunMs: 0,
    characterBeforeArena: null as string | null,
    tavernCleared: false,
    tavernWeaponCount: 0,
};

/**
 * The fields a slot carries over from the live state.
 *
 * These are exactly the persisted slice plus the two display lines a card shows;
 * keeping the list literal (rather than spreading the whole state) is what stops a
 * future UI flag from leaking into every old save.
 */
function buildSlotRecord(
    state: GameUIState,
    thumbnail: string | undefined,
): SaveSlotRecord {
    return {
        version: SLOT_RECORD_VERSION,
        savedAt: new Date().toISOString(),
        levelTitle: state.levelTitle || state.currentLevelId,
        levelId: state.currentLevelId,
        characterName: state.characterName,
        elapsedMs: state.levelElapsedMs,
        money: state.money,
        thumbnail,
        data: {
            currentLevelId: state.currentLevelId,
            levelProgressMap: state.levelProgressMap,
            characterName: state.characterName,
            hp: state.hp,
            maxHp: state.maxHp,
            sp: state.sp,
            maxSp: state.maxSp,
            slots: state.slots,
            inventory: state.inventory,
            spawnedRegions: state.spawnedRegions,
            activeWeaponIndex: state.activeWeaponIndex,
            levelElapsedMs: state.levelElapsedMs,
            playerSnapshot: state.playerSnapshot,
            activeMonstersSnapshot: state.activeMonstersSnapshot,
            groundDropsSnapshot: state.groundDropsSnapshot,
            selectedCharacterId: state.selectedCharacterId,
            tavernCleared: state.tavernCleared,
            brokenProps: state.brokenProps,
            usedTriggers: state.usedTriggers,
            catShopGiftGiven: state.catShopGiftGiven,
            money: state.money,
            upgradeLevels: state.upgradeLevels,
            weaponLevels: state.weaponLevels,
            locale: state.locale,
            inputScheme: state.inputScheme,
        },
    };
}

/** Read one slot, or null when it is empty, unparseable or from another version. */
function readSlot(id: SaveSlotId): SaveSlotRecord | null {
    try {
        const raw = window.localStorage.getItem(saveSlotKey(id));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isSaveSlotRecord(parsed) ? parsed : null;
    } catch {
        // Corrupt JSON or storage disabled: treat as empty rather than throw at a
        // caller that is mid-menu.
        return null;
    }
}

export const useGameStore = create<GameUIState>()(
    persist(
        (set, get) => ({
            ...initialGameState,

            setLevelTitle: (title) => set({ levelTitle: title }),
            setMerchantReady: (ready) => set({ merchantReady: ready }),

            setShopTitle: (key) => set({ shopTitleKey: key }),

            openCatShop: () => {
        const due = !get().catShopGiftGiven;
        set({ shopTitleKey: 'shop.catTitle', merchantReady: true, catShopGiftGiven: true });
        return due;
    },

    mergeOwnedWeapon: (weaponId, maxLevel) => {
        const state = get();
        if (!state.slots.some((slot) => slot.id === weaponId)) return false;
        const level = state.weaponLevels[weaponId] ?? 0;
        const ladderMax = Math.max(0, maxLevel);
        const nextLevel = Math.min(level + 1, ladderMax);
        set((current) => {
            const slots = current.slots.map((slot) =>
                slot.id === weaponId
                    ? {
                          ...slot,
                          ammo: slot.clipSize,
                          reserve: reserveMaxFor(slot.clipSize, nextLevel),
                      }
                    : slot,
            );
            const active = slots[current.activeWeaponIndex];
            return {
                weaponLevels: { ...current.weaponLevels, [weaponId]: nextLevel },
                slots,
                activeAmmo: active ? active.ammo : current.activeAmmo,
                activeMaxAmmo: active ? active.clipSize : current.activeMaxAmmo,
            };
        });
        return true;
    },

            setCurrentLevelId: (levelId) => set({ currentLevelId: levelId }),

            setWaveProgress: (levelId, progress) =>
                set((state) => {
                    const targetLevelId = levelId || state.currentLevelId;
                    if (!targetLevelId) return state;
                    const existing = state.levelProgressMap[targetLevelId] || {
                        currentWaveIndex: 0,
                        clearedWaveIds: [],
                    };
                    return {
                        levelProgressMap: {
                            ...state.levelProgressMap,
                            [targetLevelId]: {
                                currentWaveIndex:
                                    progress.currentWaveIndex ?? existing.currentWaveIndex,
                                clearedWaveIds: progress.clearedWaveIds ?? existing.clearedWaveIds,
                            },
                        },
                    };
                }),

            setLevelElapsedMs: (ms) => set({ levelElapsedMs: ms }),

            setEntitySnapshots: (snapshots) =>
                set((state) => ({
                    ...state,
                    playerSnapshot: snapshots.player ?? state.playerSnapshot,
                    activeMonstersSnapshot: snapshots.monsters ?? state.activeMonstersSnapshot,
                    groundDropsSnapshot: snapshots.drops ?? state.groundDropsSnapshot,
                    levelElapsedMs: snapshots.elapsedMs ?? state.levelElapsedMs,
                })),

            setCharacterStats: (stats) =>
                set((state) => ({
                    ...state,
                    characterName: stats.name ?? state.characterName,
                    hp: stats.hp,
                    maxHp: stats.maxHp,
                    sp: stats.sp,
                    maxSp: stats.maxSp,
                })),

            setWeaponStats: (stats) =>
                set((state) => ({
                    ...state,
                    activeWeaponIndex: stats.activeIndex,
                    activeWeaponName: stats.name,
                    activeAmmo: stats.ammo,
                    activeMaxAmmo: stats.maxAmmo,
                    isReloading: stats.isReloading,
                    reloadProgress: stats.reloadProgress,
                    slots: stats.slots,
                })),

            setHubsVisible: (visible) => set({ hubsVisible: visible }),

            setDead: (dead) => set({ isDead: dead }),

            setVictory: (victory) => set({ isVictory: victory }),

            addMoney: (amount) =>
                set((state) =>
                    Number.isFinite(amount) && amount > 0
                        ? { money: state.money + Math.floor(amount) }
                        : state,
                ),

            spendMoney: (amount) => {
                if (!Number.isFinite(amount) || amount < 0) return false;
                const price = Math.floor(amount);
                let paid = false;
                set((state) => {
                    if (price > state.money) return state;
                    paid = true;
                    return { money: state.money - price };
                });
                return paid;
            },

            setUpgradeLevel: (upgradeId, level) =>
                set((state) => ({
                    upgradeLevels: {
                        ...state.upgradeLevels,
                        [upgradeId]: Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0,
                    },
                })),

            setWeaponLevel: (weaponId, level) =>
                set((state) => ({
                    weaponLevels: {
                        ...state.weaponLevels,
                        [weaponId]: Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0,
                    },
                })),

            addInventoryItem: (dropId, count) => {
                let added = 0;
                set((state) => {
                    const result = addToInventory(state.inventory, dropId, count);
                    added = result.added;
                    return result.added > 0 ? { inventory: result.slots } : {};
                });
                return added;
            },

            consumeInventorySlot: (index) => {
                let taken: string | null = null;
                set((state) => {
                    const slot = state.inventory[index];
                    if (!slot) return {};
                    taken = slot.dropId;
                    return { inventory: removeFromInventory(state.inventory, index, 1) };
                });
                return taken;
            },

            setDropCatalog: (entries) => set({ dropCatalog: entries }),

            setBackpackOpen: (open) => set({ backpackOpen: open }),

            markRegionSpawned: (key) =>
                set((state) =>
                    state.spawnedRegions.includes(key)
                        ? {}
                        : { spawnedRegions: [...state.spawnedRegions, key] },
                ),

            sellInventorySlot: (index) => {
                let earned = 0;
                set((state) => {
                    const slot = state.inventory[index];
                    if (!slot) return {};
                    const unitPrice = Math.max(
                        0,
                        Math.floor(state.dropCatalog[slot.dropId]?.sellPrice ?? 0),
                    );
                    if (unitPrice === 0) return {};
                    earned = unitPrice;
                    return {
                        inventory: removeFromInventory(state.inventory, index, 1),
                        money: state.money + unitPrice,
                    };
                });
                return earned;
            },

            sellEverything: () => {
                let earned = 0;
                set((state) => {
                    const value = bagSellValue(state.inventory, state.dropCatalog);
                    if (value === 0) return {};
                    earned = value;
                    // Keep unsellable items; drop only what the shop pays for.
                    const kept = state.inventory.filter(
                        (slot) =>
                            Math.max(0, Math.floor(state.dropCatalog[slot.dropId]?.sellPrice ?? 0)) ===
                            0,
                    );
                    return { inventory: kept, money: state.money + value };
                });
                return earned;
            },

            refillWeaponAmmo: (weaponId) =>
                set((state) => {
                    const level = state.weaponLevels[weaponId] ?? 0;
                    const slots = state.slots.map((slot) =>
                        slot.id === weaponId
                            ? {
                                  ...slot,
                                  ammo: slot.clipSize,
                                  reserve: reserveMaxFor(slot.clipSize, level),
                              }
                            : slot,
                    );
                    const active = slots[state.activeWeaponIndex];
                    return {
                        slots,
                        activeAmmo: active ? active.ammo : state.activeAmmo,
                        activeMaxAmmo: active ? active.clipSize : state.activeMaxAmmo,
                    };
                }),

            refillAmmo: () =>
                set((state) => {
                    const slots = state.slots.map((slot) => ({
                        ...slot,
                        ammo: slot.clipSize,
                        // The reserve is what the shop actually sells now: a
                        // magazine refills itself out of it. Its cap grows with
                        // the weapon's own upgrade level.
                        reserve: reserveMaxFor(
                            slot.clipSize,
                            state.weaponLevels[slot.id] ?? 0,
                        ),
                    }));
                    // Refresh the derived active-ammo mirrors too, so the HUD
                    // does not keep showing the pre-refill count.
                    const active = slots[state.activeWeaponIndex];
                    return {
                        slots,
                        activeAmmo: active ? active.ammo : state.activeAmmo,
                        activeMaxAmmo: active ? active.clipSize : state.activeMaxAmmo,
                    };
                }),

            setPetBonus: (bonus) => set({ petBonus: bonus }),
            setInputScheme: (inputScheme) => set({ inputScheme }),
        setLocale: (code) => {
                // Keep the pure i18n runtime in step with the persisted
                // choice — the runtime owns `t()` / `pickText()`, the store
                // only owns the preference.
                setLocaleRuntime(code);
                set({ locale: code });
            },

            resetLevelProgress: (levelId) =>
                set((state) => {
                    const newMap = { ...state.levelProgressMap };
                    delete newMap[levelId];
                    return {
                        levelProgressMap: newMap,
                        hp: 0,
                        sp: 0,
                        slots: [],
                        playerSnapshot: undefined,
                        activeMonstersSnapshot: undefined,
                        groundDropsSnapshot: undefined,
                        levelElapsedMs: 0,
                    };
                }),

            /**
             * Clear only the per-scene entity snapshots so the new
             * scene's loadCharacter() reads a clean slate. Used by
             * scene transitions (teleport, Jump-to-scene) where the
             * player's stats / hotbar must survive — only the world
             * position should reset.
             */
            clearSceneSnapshots: () =>
                set(() => ({
                    playerSnapshot: undefined,
                    activeMonstersSnapshot: undefined,
                    groundDropsSnapshot: undefined,
                })),

            listSaveSlots: () => {
                const slots = {} as Record<SaveSlotId, SaveSlotRecord | null>;
                const all: SaveSlotId[] = [...SAVE_SLOT_IDS, QUICK_SLOT_ID];
                for (const id of all) {
                    slots[id] = readSlot(id);
                }
                return slots;
            },

            saveToSlot: (id, thumbnail) => {
                const state = get();
                // Nothing worth saving before the first level: a slot holding an
                // empty character would load into a black screen.
                if (!state.currentLevelId) return null;
                const record = buildSlotRecord(state, thumbnail);
                try {
                    window.localStorage.setItem(saveSlotKey(id), JSON.stringify(record));
                } catch {
                    // Quota or a locked-down browser: the caller shows the failure.
                    return null;
                }
                return record;
            },

            loadFromSlot: (id) => {
                const record = readSlot(id);
                if (!record) return false;
                // The payload is the same slice the autosave persists, so applying
                // it is one setState; the scene restarts from it.
                set(() => ({ ...(record.data as Partial<GameUIState>) }));
                return true;
            },

            deleteSaveSlot: (id) => {
                try {
                    window.localStorage.removeItem(saveSlotKey(id));
                } catch {
                    // Nothing to undo if the browser refused the read.
                }
            },

            clearSaveData: () => {
                try {
                    useGameStore.persist?.clearStorage();
                } catch {
                    // Fallback
                }
                // The world outlives the run: everything else reset here is run
                // state (money, weapons, the picked character), but a prop the
                // player shot open is level furniture. Re-locking the tavern
                // ornament would mean re-shooting it after every death.
                const { brokenProps } = useGameStore.getState();
                set(() => ({
                    ...initialGameState,
                    tavernCleared: false,
                    selectedCharacterId: null,
                    brokenProps,
                }));
                setLocaleRuntime(initialGameState.locale);
            },

            setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
            openDevCabin: () => set({ devCabinOpen: true }),
            closeDevCabin: () => set({ devCabinOpen: false }),
            openComicIntro: (levelId) =>
                set((state) => ({
                    comicIntroLevelId: levelId,
                    comicPlayedLevels: state.comicPlayedLevels.includes(levelId)
                        ? state.comicPlayedLevels
                        : [...state.comicPlayedLevels, levelId],
                })),
            closeComicIntro: () => set({ comicIntroLevelId: null }),
            openSettlement: (runMs) => set({ settlementOpen: true, settlementRunMs: runMs }),
            closeSettlement: () => set({ settlementOpen: false }),
            setCharacterBeforeArena: (id) => set({ characterBeforeArena: id }),
            setTavernCleared: (cleared) => set({ tavernCleared: cleared }),
            setTavernWeaponCount: (n) => set({ tavernWeaponCount: n }),
            markPropBroken: (key) =>
                set((state) =>
                    state.brokenProps.includes(key)
                        ? {}
                        : { brokenProps: [...state.brokenProps, key] },
                ),
            markTriggerUsed: (key) =>
                set((state) =>
                    state.usedTriggers.includes(key)
                        ? {}
                        : { usedTriggers: [...state.usedTriggers, key] },
                ),
        }),
        {
            name: '11th_forest_save_v2',
            partialize: (state) => ({
                currentLevelId: state.currentLevelId,
                levelProgressMap: state.levelProgressMap,
                characterName: state.characterName,
                hp: state.hp,
                maxHp: state.maxHp,
                sp: state.sp,
                maxSp: state.maxSp,
                slots: state.slots,
                inventory: state.inventory,
                spawnedRegions: state.spawnedRegions,
                activeWeaponIndex: state.activeWeaponIndex,
                levelElapsedMs: state.levelElapsedMs,
                playerSnapshot: state.playerSnapshot,
                activeMonstersSnapshot: state.activeMonstersSnapshot,
                groundDropsSnapshot: state.groundDropsSnapshot,
                // Tavern
                selectedCharacterId: state.selectedCharacterId,
                tavernCleared: state.tavernCleared,
                // World state — survives a death restart.
                brokenProps: state.brokenProps,
                usedTriggers: state.usedTriggers,
                catShopGiftGiven: state.catShopGiftGiven,
                // Economy + upgrades
                money: state.money,
                upgradeLevels: state.upgradeLevels,
                weaponLevels: state.weaponLevels,
                // Language
                locale: state.locale,
                inputScheme: state.inputScheme,
            }),
            onRehydrateStorage: () => (state) => {
                // A restored save carries the player's language choice;
                // apply it to the runtime, which owns `t()` / `pickText()`.
                if (state?.locale) setLocaleRuntime(state.locale);
            },
        },
    ),
);
