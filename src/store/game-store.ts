import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { setLocale as setLocaleRuntime, type LocaleCode } from '@/locales';

export interface WeaponSlotData {
    id: string;
    name: string;
    ammo: number;
    clipSize: number;
    /** Public-path URL for the weapon thumbnail (e.g. `/assets/image/weapons/arcana-staff.png`).
     *  Undefined for melee weapons or spec.visual entries without a texture. */
    texture?: string;
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

    /** Transient, never persisted: the mysterious merchant is standing on the
     *  current level, so her shop is available. The scene sets it when she
     *  appears (all monsters cleared) and clears it on teardown. */
    merchantReady: boolean;

    // Economy — the tavern shop's currency. Earned as a per-monster
    // bounty (`monsters/monster.ts` → `kill()`) and spent in the tavern.
    // Persisted, so a purchase survives a refresh. Wiped by clearSaveData
    // along with the rest of the run — death is a full reset, not a bank.
    money: number;

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
    locale: LocaleCode;

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
    /** Switch language; mirrors into the i18n runtime immediately. */
    setLocale: (code: LocaleCode) => void;
    resetLevelProgress: (levelId: string) => void;
    /**
     * Clear per-scene entity snapshots only (player/monster/drop
     * positions). Preserves the player's hotbar, HP, SP, and
     * character choice. Used by scene transitions (teleport, Jump-
     * to-scene) so picked-up weapons survive the cut.
     */
    clearSceneSnapshots: () => void;
    clearSaveData: () => void;
    setSelectedCharacterId: (id: string | null) => void;
    openComicIntro: (levelId: string) => void;
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

    money: 0,
    // World state, not run state — `clearSaveData` deliberately keeps it.
    brokenProps: [] as string[],
    // Run state, not world state — a new run earns the trigger again.
    usedTriggers: [] as string[],

    upgradeLevels: {} as Record<string, number>,
    weaponLevels: {} as Record<string, number>,
    locale: detectLocale(),

    playerSnapshot: undefined as PlayerSnapshot | undefined,
    activeMonstersSnapshot: undefined as MonsterSystemSnapshot | undefined,
    groundDropsSnapshot: undefined as DropEntitySnapshot[] | undefined,

    hubsVisible: true,
    isDead: false,
    isVictory: false,

    selectedCharacterId: null as string | null,
    comicIntroLevelId: null as string | null,
    comicPlayedLevels: [] as string[],
    settlementOpen: false,
    settlementRunMs: 0,
    characterBeforeArena: null as string | null,
    tavernCleared: false,
    tavernWeaponCount: 0,
};

export const useGameStore = create<GameUIState>()(
    persist(
        (set) => ({
            ...initialGameState,

            setLevelTitle: (title) => set({ levelTitle: title }),
            setMerchantReady: (ready) => set({ merchantReady: ready }),

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

            refillAmmo: () =>
                set((state) => {
                    const slots = state.slots.map((slot) => ({ ...slot, ammo: slot.clipSize }));
                    // Refresh the derived active-ammo mirrors too, so the HUD
                    // does not keep showing the pre-refill count.
                    const active = slots[state.activeWeaponIndex];
                    return {
                        slots,
                        activeAmmo: active ? active.ammo : state.activeAmmo,
                        activeMaxAmmo: active ? active.clipSize : state.activeMaxAmmo,
                    };
                }),

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
                // Economy + upgrades
                money: state.money,
                upgradeLevels: state.upgradeLevels,
                weaponLevels: state.weaponLevels,
                // Language
                locale: state.locale,
            }),
            onRehydrateStorage: () => (state) => {
                // A restored save carries the player's language choice;
                // apply it to the runtime, which owns `t()` / `pickText()`.
                if (state?.locale) setLocaleRuntime(state.locale);
            },
        },
    ),
);
