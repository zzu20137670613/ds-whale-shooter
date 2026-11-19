import * as Phaser from 'phaser';

import { createArenaArrow } from '@/game/bosses/arena-arrow';
import { drawFloorText } from '@/game/levels/floor-text';
import { CHARACTER_SAY_EVENT } from '@/lib/inventory/events';
import { GuidePointer } from '@/game/levels/guide-pointer';
import { LastMonsterPointer } from '@/game/monsters/last-monster-pointer';
import { ExitArrow } from '@/game/levels/exit-arrow';
import { BossArenaLoop } from '@/game/bosses/arena-loop';
import { BOSS_PHASES, bossSettlementDue } from '@/lib/bosses/phases';
import { pickText } from '@/locales';

import {
    createCharacterAnims,
    loadCharacter,
    loadCharacterAssets,
    type CharacterRuntime,
} from '@/game/characters/character';
import { AudioController, loadAudioAssets } from '@/game/audios/logic';
import { createDropAnims, DropController, loadDropAssets } from '@/game/drops/drop';
import {
    ensureTokenBeamAnim,
    levelNeedsTokenBeam,
    loadTokenBeam,
    TOKEN_BEAM_TEXTURE,
} from '@/game/drops/token-beam';
import { MaterialManager } from '@/game/materials/material';
import { placeBody } from '@/game/physics/matter-body';
import { arrivalActions } from '@/lib/levels/arrival-eggs';
import { heldMaxBonus } from '@/lib/drops/held-bonus';
import { createQuipTicker, sayQuip, type QuipTicker } from '@/game/characters/quips';
import {
    createMonsterAnims,
    loadMonsterAssets,
    MonsterController,
    rollDrops,
    type Monster,
} from '@/game/monsters/monster';

import { PathfindingService } from '@/game/monsters/logic';
import { RegionSpawner } from '@/game/monsters/region-spawner';
import {
    createPathDebugOverlay,
    type PathDebugOverlayHandles,
} from '@/game/monsters/path-debug-overlay';
import {
    DEPTH,
    MERCHANT_TEXTURE_KEY,
    MERCHANT_TEXTURE_PATH,
    MUSIC_EVENT,
    MUSIC_STOP,
    PIXEL_LIGHTING_CONFIG,
    RENDER_CAMERA_LERP,
    SFX_EVENT,
} from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { fetchWeapon } from '@/lib/weapons/loader';
import { applyWeaponUpgrade, maxWeaponUpgradeLevel } from '@/lib/weapons/upgrades';
import { setBootProgress } from '@/lib/boot-loading/progress';
import { setCurrentLevel } from '@/lib/levels/current-level';
import { actorScaleFor } from '@/lib/levels/actor-scale';
import { takePreviewSpawn } from '@/lib/dev/preview-spawn';
import { recordCrash } from '@/lib/dev/crash-log';
import { restoredWeaponsFor, startingWeaponsFor } from '@/lib/characters/starting-weapons';
import { giveCatGift } from '@/lib/levels/cat-gift';
import { CAT_SHOP_GIFT_WEAPON_ID } from '@/lib/levels/easter-eggs';
import { RICE_BOWL_ACTION, RICE_BOWL_DROP_ID } from '@/lib/levels/easter-eggs';
import { CAT_SHOP_GIFT_DROP_ID } from '@/lib/levels/easter-eggs';
import { fetchLevelIndex } from '@/lib/levels/loader';
import {
    groundDisplaySize,
    groundLayers,
    isPortalArmed,
    propKey,
    spawnsWithoutBrokenProps,
} from '@/lib/levels/logic';
import { BOSS_PHASE_CLEAR_EVENT, phaseClearReward } from '@/lib/bosses/phase-reward';
import { MERCHANT_SHOP_EVENT, usesMerchant } from '@/lib/merchant/logic';
import {
    EPILOGUE_CAT_TEXTURE_KEY,
    SEED_TEXTURE_KEY,
    SEED_TEXTURE_PATH,
    epilogueCatFor,
} from '@/lib/story/epilogue-npcs';
import { releasableTextureKeys } from '@/lib/textures/release';
import { tilemapResourcesFor } from '@/lib/tilemaps/resources';
import { resolveAndRestart } from '@/lib/phaser-game';
import { quickSave } from '@/lib/saves/quick';
import { t } from '@/locales';
import { InteractableController } from '@/game/scenes/interactable';
import { useGameStore } from '@/store/game-store';
import type { MusicSpec, SfxSpec, SoundSpec } from '@/lib/audios';
import type { CharacterSpec } from '@/lib/characters';
import type { DropSpec } from '@/lib/drops';
import type { Level } from '@/lib/levels/types';
import type { MonsterSpec } from '@/lib/monsters';
import type { WeaponSpec } from '@/lib/weapons';

import { createWallBodies } from '@/game/walls/wall';
import { MerchantController } from '@/game/merchant/merchant-controller';

/**
 * Payload the Game shell hands to the scene after pre-fetching all data
 * (level + weapons + character + monster types + drop types referenced
 * by this level). Phaser's init() does NOT await async work, so anything
 * async is resolved in main.ts before the Game is constructed.
 *
 * Maps are keyed by id for O(1) lookup during scene spawn. Drop types
 * only need static-spawn entries; monster-death drops are resolved on
 * demand inside the DropController callback (kept lazy until Phase 5).
 */
export interface SceneAssets {
    /** All weapons (player hotbar + monster weapons), keyed by id. */
    weaponsById: Map<string, WeaponSpec>;
    /** Player hotbar (subset of weaponsById, in order). */
    weapons: WeaponSpec[];
    character: CharacterSpec;
    /** Computed cell size for the character sprite sheet. */
    spriteCell: { width: number; height: number };
    monsterSpecs: Map<string, MonsterSpec>;
    /** Measured cell size per monster sheet - needed before `preload()` queues them. */
    monsterCells: Map<string, { width: number; height: number }>;
    dropSpecs: Map<string, DropSpec>;
    /** SFX + music loaded from audios/index.yaml. */
    sfxSpecs: Map<string, SfxSpec>;
    musicSpecs: Map<string, MusicSpec>;
    /** Weapon ids referenced by monster specs in this level. Their
     *  `visual.texture` is NOT loaded — only `bullet.texture` is. */
    monsterWeaponIds: Set<string>;
    /** Weapon ids the player can hold / see rendered: character hotbar
     *  + tavern dropSpawn entries. These get the full visual+bullet
     *  texture load. */
    playerWeaponIds: Set<string>;
    /** Tavern mode only: all playable characters for NPC display + selection. */
    allCharacters?: CharacterSpec[];
    characterCells?: Record<string, { width: number; height: number }>;
}

/**
 * Generic scene loader. The Level is fetched by the caller (main.ts)
 * and passed in via the constructor — Phaser's `init()` does NOT await
 * async work, so doing the fetch here would race with `preload()`.
 *
 * One scene class covers every level — there is no per-level file.
 *
 * This scene only renders the background image. Wall rendering and the
 * editor's drawing tools live in the editor panel (Konva overlay), not
 * here. Keeps the scene focused on what gameplay needs.
 */
import { consumeTeleportArrival, TeleporterController } from '@/game/scenes/teleporter';
import { TavernController } from '@/game/scenes/tavern-controller';
import { TriggerController } from '@/game/scenes/trigger';
import { loadWeaponAssets } from '@/game/weapons/weapon';

export class LoadScene extends Phaser.Scene {
    private character!: CharacterRuntime;
    /** 「隔一分多钟说一句」的计时器（只有鲸鱼娘、只在关卡里）。 */
    private quipTicker?: QuipTicker;

    /**
     * 按**当前背包**把「带在身上就生效」的上限加成补到角色身上（加冕之冠）。
     *
     * 每次 `loadCharacter` 之后都要调：角色的 spec 是新建的，不会自己带着上一份加成。
     * 关卡里捡到的那一刻由 `drop.ts` 直接调 `adjustHeldMaxBonus`，不用等重进场景。
     */
    private applyHeldMaxBonus(): void {
        if (!this.character) return;
        const bonus = heldMaxBonus(
            useGameStore.getState().inventory,
            (dropId) => this.assets.dropSpecs.get(dropId),
        );
        this.character.adjustHeldMaxBonus(bonus);
    }
    /**
     * Whether the level counts as finished.
     *
     * Levels with a `spawner` (the library, the sky city, Atlantis) must also have
     * fired every wave - otherwise the field would read as "empty" during the two
     * seconds before the first wave and the exit portal would pop immediately.
     * Every other level keeps the original rule: no monsters, no pending spawns.
     */
    private isLevelCleared(): boolean {
        if (!this.monsterSystem.isAllCleared()) return false;
        return this.regionSpawner ? this.regionSpawner.isDone() : true;
    }

    private monsterSystem!: MonsterController;
    /** Follow-spawn waves; only built when the level declares a `spawner`. */
    private regionSpawner?: RegionSpawner;
    /** Collision grid, kept so the boss walk can test a landing point for floor. */
    private pathfinder?: PathfindingService;
    /** The four-block boss walk; only on a boss level. */
    private bossArena?: BossArenaLoop;
    /** Bound listener for CHARACTER_SAY_EVENT, so shutdown can unbind exactly it. */
    /** Floor labels drawn for this level, destroyed with the scene. */
    private floorTextObjects: Phaser.GameObjects.Text[] = [];
    /** Bound listener for the `ui-typing` flag. */
    private typingListener?: (typing: boolean) => void;
    private sayListener?: (payload: { text: string; durationMs?: number }) => void;
    /** Orbiting arrow toward the exit target (Atlantis's throne). */
    private guidePointer?: GuidePointer;
    /** Points at the last monster or two when the map is nearly clear. */
    private lastMonsterPointer?: LastMonsterPointer;
    /** The "this way to the exit" arrow; only on levels that declare one. */
    private exitArrow?: ExitArrow;
    /** Present only in the four-block worlds — see `usesMerchant`. */
    private merchant?: MerchantController;
    private dropSystem!: DropController;
    private materialManager!: MaterialManager;
    private teleporterSystem!: TeleporterController;
    private triggerSystem!: TriggerController;
    /** Click targets painted into the art (the cabin's two screens). */
    private interactables?: InteractableController;

    /** When this level started, for the ending's ledger. */
    private levelStartedAtMs = 0;
    private audio!: AudioController;
    private pathDebugOverlay!: PathDebugOverlayHandles;
    private tavernController?: TavernController;
    /** `this.time.now` value at the moment create() finished wiring the
     *  level. Subtracted from current `this.time.now` to get elapsed. */
    private levelStartAt = 0;
    /** Last time we wrote the save state (clock + snapshots). Throttled
     *  to 1Hz — see `tickSaveState`. */
    private lastSavePushAt = 0;

    constructor(
        private readonly id: string,
        private readonly level: Level,
        private readonly assets: SceneAssets,
    ) {
        super(`LoadScene:${id}`);
    }

    preload(): void {
        // Real asset progress into the #boot loading bar (no-op once the splash is gone).
        this.load.on('progress', (v: number) => setBootProgress(v));

        // Remember every key this scene loads so shutdown() can hand the
        // textures back — see `releaseLoadedTextures`.
        this.load.on('filecomplete', (key: string) => this.loadedTextureKeys.add(key));

        // Per-scene texture key — `background` alone collides with the
        // texture cache: Phaser reuses the first loaded image under
        // that key, so every subsequent scene would render the first
        // scene's background. Namespace with the scene id.
        if (this.level.tilemap) {
            // A tiled level draws from an atlas, so the painted `background`
            // is never fetched: no bandwidth, no texture, no release later.
            const tilemap = tilemapResourcesFor(this.id, this.level.tilemap);
            this.load.tilemapTiledJSON(tilemap.mapKey, tilemap.mapPath);
            this.load.image(tilemap.atlasKey, tilemap.atlasPath);
        } else {
            // One image, or one image per painted block when the world is
            // wider than a single block — see `groundLayers`.
            for (const layer of groundLayers(this.id, this.level)) {
                this.load.image(layer.key, layer.path);
            }
        }

        // Default player character — same key scheme in both modes; the
        // tavern just spawns additional NPC sheets on top so the player
        // can pick from a roster.
        loadCharacterAssets(
            this,
            this.assets.character,
            this.assets.spriteCell.width,
            this.assets.spriteCell.height,
        );
        if (this.level.tavern) {
            // Tavern NPCs: every other character in the roster gets its
            // own spritesheet so TavernController can spawn idle sprites
            // for the selection UI.
            const allChars = this.assets.allCharacters ?? [];
            for (const spec of allChars) {
                // Per-character cell, read from her own PNG. A flat 128 used to crop the
                // 768 sheets to their top-left corner.
                const cell = this.cellFor(spec.id);
                loadCharacterAssets(this, spec, cell.width, cell.height);
            }
        }

        // Load monster spritesheet assets (if spec contains sprite config)
        loadMonsterAssets(this, this.assets.monsterSpecs.values(), this.assets.monsterCells);
        // Load drop spritesheet assets
        loadDropAssets(this, this.assets.dropSpecs.values());
        // 词元盾的光柱：只有这一关真的会掉盾时才加载那张 1.5 MB 的序列帧。
        // 传整份 spec，不只是 effect：加冕之冠是靠 `beam` 字段要光柱的。
        if (levelNeedsTokenBeam([...this.assets.dropSpecs.values()])) {
            loadTokenBeam(this);
        }
        // Load weapon & bullet visual assets. Player-pickup weapons
        // (character hotbar + tavern dropSpawns) get their in-hand
        // texture loaded — the player holds them, and the drop-on-
        // ground visual reuses the same texture. Monster weapons
        // only need their bullet texture; their in-hand sprite is
        // Monster weapons also load their `visual.texture` — every
        // MonsterInstance mounts a WeaponVisualController that
        // renders the in-hand weapon sprite. Skipping that load
        // (as a "monster weapons don't need it" optimization) left
        // monsters holding invisible weapons.
        const playerWeapons = [...this.assets.playerWeaponIds]
            .map((id) => this.assets.weaponsById.get(id))
            .filter((w): w is WeaponSpec => Boolean(w));
        const monsterWeapons = [...this.assets.monsterWeaponIds]
            .map((id) => this.assets.weaponsById.get(id))
            .filter((w): w is WeaponSpec => Boolean(w));
        loadWeaponAssets(this, playerWeapons, { loadVisualTexture: true });
        loadWeaponAssets(this, monsterWeapons, { loadVisualTexture: true });
        // Audio assets — every SFX + music track gets queued here.
        loadAudioAssets(this, [
            ...this.assets.sfxSpecs.values(),
            ...this.assets.musicSpecs.values(),
        ] as Iterable<SoundSpec>);
        MaterialManager.preloadMaterials(this, this.level.materials);

        // The merchant only exists in the four-block worlds, so only those
        // pay for her texture.
        if (usesMerchant(this.level)) {
            this.load.image(MERCHANT_TEXTURE_KEY, MERCHANT_TEXTURE_PATH);
        }

        // 创世线: after the ending, the three worlds grow a cat beside the merchant and the
        // pavilion grows seed. Only the epilogue pays for these textures.
        if (useGameStore.getState().endingCleared) {
            const cat = epilogueCatFor(this.id, true);
            if (cat) this.load.image(EPILOGUE_CAT_TEXTURE_KEY, cat.texture);
            if (this.level.tavern) {
                this.load.image(SEED_TEXTURE_KEY, SEED_TEXTURE_PATH);
            }
        }
    }

    create(): void {
        // World coords are image pixel space either way — the ground is just
        // painted one tile at a time when the level carries a tilemap. Air
        // walls, physics bounds and pathfinding therefore align 1:1 no matter
        // which of the two drew it.
        const isPixelLightingEnabled = this.level.pixelLighting ?? PIXEL_LIGHTING_CONFIG.ENABLE;
        this.createGround(
            isPixelLightingEnabled ? PIXEL_LIGHTING_CONFIG.BACKGROUND_TINT : undefined,
        );

        // Lock the physics world to the level image bounds so the
        // character can't run off-screen. thickness=200 is generous so
        // corners are fully covered and a fast body can't tunnel.
        this.matter.world.setBounds(
            0,
            0,
            this.level.imageSize.width,
            this.level.imageSize.height,
            200,
        );

        // Build static Matter bodies for every air wall + outer boundary walls.
        createWallBodies(this.matter, this.level.airWalls, this.level.imageSize);

        // ── Animations ──────────────────────────────────────────────────
        // Player character always; tavern NPCs in addition (so the
        // selection UI has idle sprites to show).
        createCharacterAnims(this, this.assets.character);
        if (this.level.tavern) {
            const allChars = this.assets.allCharacters ?? [];
            for (const spec of allChars) {
                createCharacterAnims(this, spec);
            }
        } else {
            // Tavern has no monsters; non-tavern scenes register them.
            createMonsterAnims(this, this.assets.monsterSpecs.values());
        }
        createDropAnims(this, this.assets.dropSpecs.values());
        // 动画只登记，不占资源；贴图不在时 `createTokenBeam` 会退回旧矩形。
        if (this.textures.exists(TOKEN_BEAM_TEXTURE)) ensureTokenBeamAnim(this);

        // ── Player character ────────────────────────────────────────────
        // Tavern mode spawns a *placeholder*: a visual sprite with a
        // hidden body but NO weapons, NO HUDs, NO controller. That's
        // loadCharacter's `placeholder: true` mode — it deliberately
        // skips every gameplay module so phase 1 (NPC selection) can't
        // fire bullets, play weapon SFX, or write to the React HUD
        // store. On confirm, the scene destroys this placeholder and
        // calls loadCharacter() again with the picked spec; monster /
        // drop subsystems get rewired to the new body via their
        // setPlayerBody / setCharacter methods.
        //
        // Non-tavern levels spawn the real character directly.
        this.character = loadCharacter(
            this,
            this.level,
            this.assets.character,
            // The guns she is CARRYING, not the YAML hotbar. `this.assets.weapons` is the
            // starting loadout and knows nothing about pickups, so passing it here dropped
            // the cat's assault rifle every time the player walked into a level. The tavern
            // refresh path already got this right; this is the path every other level takes.
            restoredWeaponsFor(
                this.assets.character,
                this.assets.weaponsById,
                useGameStore.getState().slots,
            ),
            {
                placeholder: this.level.tavern === true,
                weaponsById: this.assets.weaponsById,
                // Rooms drawn around a much larger human need a larger sprite, or
                // she reads as a doll on the stage. See lib/levels/actor-scale.
                spriteScaleMultiplier: actorScaleFor(this.id),
                // 1-to-1 pairing: arriving through a portal puts the player
                // next to the partner portal instead of the level's own spawn.
                // `?at=x,y` (see lib/dev/preview-spawn) wins over the portal marker so the
                // throne egg and the merchant junction can be looked at without a playthrough.
                spawnOverride:
                    takePreviewSpawn(this.id) ?? consumeTeleportArrival(this.id) ?? undefined,
            },
        );
        this.applyHeldMaxBonus();
        // 台词计时器：只给鲸鱼娘、只在关卡里（亭台是选人界面，不说话）。
        this.quipTicker?.destroy();
        this.quipTicker = createQuipTicker({
            characterId: this.assets.character.id,
            isTavern: this.level.tavern === true,
            say: sayQuip,
        });

        // Editor panel hides the on-canvas HUDs so the level / walls are
        // unencumbered for editing. EditorPanel emits via EventBus since
        // it lives in React and can't reach Phaser GameObjects directly.
        // Tavern placeholder has no HUDs / debug rects — skip silently.
        const setHubsVisible = (visible: boolean) => {
            this.character.hud?.setVisible(visible);
            this.character.weaponHud?.setVisible(visible);
            this.character.statusHud?.setVisible(visible);
        };
        const onEditorOpen = (editorOpen: unknown) => {
            const isEditor = editorOpen === true;
            setHubsVisible(!isEditor);
            this.character.debugBodyRect?.setVisible(isEditor);
            this.character.debugHitboxRect?.setVisible(isEditor);
            this.monsterSystem.setDebugVisible(isEditor);
        };
        EventBus.on('editor-open', onEditorOpen);
        const unbindEditorOpen = () => EventBus.removeListener('editor-open', onEditorOpen);
        this.events.once('shutdown', unbindEditorOpen);
        this.events.once('destroy', unbindEditorOpen);

        // Bind the subsystem-cleanup (audio.destroy() in particular) to
        // BOTH 'shutdown' AND 'destroy'. Phaser's SceneManager.remove()
        // path fires 'destroy' but NOT 'shutdown' (only boot() /
        // scene-transition do). Without the 'destroy' hook, every old
        // AudioController stays subscribed to the music event bus
        // after a scene swap, and the new scene's MUSIC_EVENT makes
        // both controllers try to play — stacked BGM. idempotent via
        // `isShutdown` so the double-binding doesn't run cleanup twice.
        this.events.once('shutdown', () => this.shutdown());
        this.events.once('destroy', () => this.shutdown());

        // Path-debug overlay stays hidden until the designer opts in via
        // the toggle in the Air-walls section — defaulting to off keeps
        // the canvas readable for the common case of just editing walls.
        const onPathDebugVisible = (visible: unknown) => {
            this.pathDebugOverlay.setVisible(visible === true);
        };
        EventBus.on('path-debug-visible', onPathDebugVisible);
        const unbindPathDebug = () =>
            EventBus.removeListener('path-debug-visible', onPathDebugVisible);
        this.events.once('shutdown', unbindPathDebug);
        this.events.once('destroy', unbindPathDebug);

        // Initialize A* Pathfinding service with level air walls
        const pathfinder = new PathfindingService(this.level.imageSize, this.level.airWalls);
        this.pathfinder = pathfinder;

        // Editor-only visualisation of the grid + per-monster paths.
        // Stays hidden in production; toggled via the path-debug-visible
        // event from the editor's Air-walls section.
        this.pathDebugOverlay = createPathDebugOverlay(this, pathfinder);

        // Follow-spawn: only the levels whose YAML declares a `spawner` block get
        // one. Every other level keeps its hand-placed waves and the old clear
        // rule untouched.
        if (this.level.spawner) {
            // Flood the floor from the player's spawn: a cell that is merely
            // wall-free can still be sealed inside a room, and a monster dropped
            // there would spend the level grinding against a bookshelf.
            const spawnPoint = this.level.characterSpawn ?? {
                x: this.level.imageSize.width / 2,
                y: this.level.imageSize.height / 2,
            };
            const reachable = pathfinder.buildReachabilityFrom(spawnPoint.x, spawnPoint.y);
            const isSpawnable = (x: number, y: number) =>
                !pathfinder.isBlocked(x, y) &&
                (reachable ? pathfinder.isReachableWith(reachable, x, y) : true);

            this.regionSpawner = new RegionSpawner({
                levelId: this.id,
                imageSize: this.level.imageSize,
                config: this.level.spawner,
                getMonster: (type) => this.assets.monsterSpecs.get(type),
                getWeapon: (weaponId) => this.assets.weaponsById.get(weaponId),
                spawn: (spec, weapon, x, y, waveId) =>
                    this.monsterSystem.spawnDynamic(spec, weapon, x, y, waveId),
                isBlocked: (x, y) => !isSpawnable(x, y),
                nearestSpawnable: (x, y) =>
                    reachable ? pathfinder.nearestReachableWith(reachable, x, y) : null,
            });
        }

        // ── The boss walk: 废墟 -> 星海 -> 街巷 -> 教堂 ────────────────
        // Built AFTER the monster controller, because walking through an arrow moves her.
        if (this.level.boss) {
            this.bossArena = new BossArenaLoop({
                imageSize: this.level.imageSize,
                phaseCount: BOSS_PHASES.length,
                movePlayer: (x, y) => {
                    // 用 `src/game/physics/matter-body.ts`，别写成 `this.matter.Body` ——
                    // Phaser 4 的 `scene.matter` 是门面，上面只有小写 `body`（BodyFactory），
                    // 没有 `Body`。2026-11-15 手机就是在这里炸的 `setPosition of undefined`。
                    placeBody(this.character.body, x, y);
                },
                moveBoss: (x, y) => this.monsterSystem.moveBoss(x, y),
                createArrow: (x, y) => createArenaArrow(this, x, y),
                // A landing point inside the seam wall would leave the player stuck, which is
                // exactly what the boss map did between the star sea and the alley.
                isFree: (x, y) => !this.pathfinder?.isBlocked(x, y),
                bossSpawns: this.level.arenaSpawn,
            });
        }

        // Wire monster controller — self-spawns from level.monsters.
        // Props the player has already shot open are not spawned again: the
        // world remembers them, see `spawnsWithoutBrokenProps`.
        //
        // 地图拆成四关之后，第 2/3/4 关的 `monsters:` 是空的：以前 boss 靠竞技场箭头"走进来"，
        // 现在每关只打一阶段，必须在开场就站在 `arenaSpawn[0]` 上（主人：`神 Claude 没出来`）。
        const monsterRows = (
            spawnsWithoutBrokenProps(
                this.id,
                this.level.monsters,
                useGameStore.getState().brokenProps,
            ) ?? []
        ).slice();

        const bossType = this.level.boss?.monsterType;
        if (bossType && !monsterRows.some((m) => m.type === bossType)) {
            const at = this.level.arenaSpawn?.[0] ?? this.level.characterSpawn;
            monsterRows.push({
                type: bossType,
                x: at?.x ?? this.level.imageSize.width / 2,
                y: at?.y ?? this.level.imageSize.height / 2,
            } as (typeof monsterRows)[number]);
        }

        this.monsterSystem = new MonsterController(
            this,
            monsterRows.map((m) => ({
                spec: this.assets.monsterSpecs.get(m.type)!,
                weapon: this.assets.weaponsById.get(
                    this.assets.monsterSpecs.get(m.type)!.weaponId,
                )!,
                x: m.x,
                y: m.y,
                trigger: m.trigger,
                waveId: m.waveId,
            })),
            this.character.body,
            {
                onMonsterDied: (monster) => {
                    // 这条回调从 `time.delayedCall` 里跑（死亡动画结束时），**不在**场景 update
                    // 的 try 里 —— 也就是一旦这里抛一次，整条 RAF 链就断了、画布永久冻住。
                    // 主人 2026-11-15 报的「打死boss必卡死」正是这一类。所以单独兜住，并且给
                    // 它一个自己的上下文名，屏幕上就能看出是"掉落这一环"出的问题。
                    try {
                        this.spawnDeathLoot(monster);
                    } catch (error) {
                        recordCrash(error, 'monster:died');
                    }
                },
                onPlayerHit: (damage) => {
                    // She cannot dodge what she cannot see: while the intro comic covers the
                    // canvas, nothing may hurt her. Belt to the boss's braces.
                    if (useGameStore.getState().comicIntroLevelId) return;
                    this.character.hurt(damage);
                },
            },
            pathfinder,
            // 四块拆开的地图各打 Claude 一阶段（`level.bossPhase`）。
            this.level.bossPhase,
        );

        // Wire drop controller — self-spawns from level.dropSpawns.
        this.dropSystem = new DropController(
            this,
            this.character,
            this.level.dropSpawns,
            (id) => {
                const spec = this.assets.dropSpecs.get(id);
                if (!spec) throw new Error(`Unknown drop id: ${id}`);
                return spec;
            },
            {
                onWeaponPickup: (weaponId) => {
                    // Picking up a weapon you already carry MERGES the two into
                    // one: +1 level and a full load. That is the seed's rifle
                    // easter egg and GPT's fangs easter egg sharing one rule, and
                    // it stops a duplicate from wasting a hotbar slot anywhere
                    // else.
                    if (this.character.weapons?.hasWeapon(weaponId)) {
                        const spec = this.assets.weaponsById.get(weaponId);
                        if (spec) {
                            const maxLevel = maxWeaponUpgradeLevel(spec);
                            const before = useGameStore.getState().weaponLevels[weaponId] ?? 0;
                            useGameStore.getState().mergeOwnedWeapon(weaponId, maxLevel);
                            // The store is a mirror; the gun in her hands is the real thing.
                            // Without this the level went up on the HUD and nothing else did.
                            const after = useGameStore.getState().weaponLevels[weaponId] ?? 0;
                            if (after > before) {
                                this.character.applyWeaponUpgrade(
                                    weaponId,
                                    applyWeaponUpgrade(spec, after),
                                );
                            }
                            EventBus.emit(SFX_EVENT('weapon-switch'));
                            return true;
                        }
                    }
                    // Tavern mode: walk-onto-drop auto-pickup / auto-
                    // swap. Below cap the weapon slots in fresh; at
                    // cap the active slot is replaced and the old
                    // weapon pops out as a parabola drop the player
                    // can pick back up. 专武 / locked slots block the
                    // auto-swap — the drop stays on the ground so the
                    // player can sidestep the locked slot by switching
                    // to an empty one first.
                    if (this.level.tavern) {
                        const weapons = this.character.weapons;
                        if (!weapons) return true;

                        const result = this.character.tryPickupWeaponById(
                            weaponId,
                            this.assets.weaponsById,
                        );
                        if (result === 'added') {
                            this.tavernController?.notifyWeaponAdded();
                            return true;
                        }
                        if (result === 'capped') {
                            const activeIdx = weapons.getActiveIndex();
                            if (this.tavernController?.isSlotLocked(activeIdx, this.character)) {
                                // Active slot is 专武 — can't auto-
                                // replace. Leave the drop on the
                                // ground; player can switch slots with
                                // 1/2/3 and walk back onto it.
                                return false;
                            }
                            const replacedSlot = weapons.getSlot(activeIdx);
                            const newSpec = this.assets.weaponsById.get(weaponId);
                            if (!replacedSlot || !newSpec) return false;
                            // Drop the replaced weapon as a parabola
                            // before swapping, so the old gun lands
                            // behind the player as the new one slots
                            // in.
                            const dropSpec = this.assets.dropSpecs.get(CAT_SHOP_GIFT_DROP_ID);
                            const charPos = this.character.body?.position;
                            if (dropSpec && charPos) {
                                this.dropSystem?.spawnWeapon(
                                    dropSpec,
                                    replacedSlot.spec,
                                    charPos.x,
                                    charPos.y,
                                );
                            }
                            weapons.replaceSlot(activeIdx, newSpec);
                            return true;
                        }
                        // 'unknown' — bail without consuming.
                        return false;
                    }
                    // The level only preloads the weapons it mentions, and the juice egg
                    // hands Gemini a staff that lives in the tavern shop - so in a level the
                    // spec is missing and the pickup silently did nothing
                    // (`哈基米喝了果汁，触发了台词，但是没有秘法法杖`). Fetch it on demand.
                    // `pickUpWeapon` only SWITCHES to a weapon already in the hotbar. Adding a
                    // new one is `tryPickupWeaponById`, which is why the juice egg's staff
                    // never appeared - she "picked up" a staff she did not yet hold
                    // (`还是只有台词没有秘法法杖`). See `lib/levels/cat-gift.ts` for the same trap.
                    const takeNew = (spec: import('@/lib/weapons').WeaponSpec) => {
                        (this.assets.weaponsById as Map<string, typeof spec>).set(weaponId, spec);
                        this.character.tryPickupWeaponById(weaponId, this.assets.weaponsById);
                    };

                    const known = this.assets.weaponsById.get(weaponId);
                    if (known) {
                        takeNew(known);
                        return true;
                    }
                    // The level only preloads the weapons it mentions; the shop's staff is not
                    // one of them, so fetch it on demand.
                    void fetchWeapon(weaponId)
                        .then(takeNew)
                        .catch((error) => {
                            console.warn(`[weapons] could not load ${weaponId}`, error);
                        });
                    return true;
                },
            },
            (id) => this.assets.weaponsById.get(id),
            this.level.tokenPillarTone,
            // 关卡 id：拾取台词按关卡判断（加冕之冠不限关卡，礁石上那杯只认海滩）。
            this.id,
        );

        // Wire bullet → monster damage flow. Player bullet only. (Player
        // bullet has its own destruction listener; this hook runs BEFORE
        // WeaponController's listener to ensure damage lands first.)
        this.matter.world.on('collisionstart', (event: any) => {
            const pairs = event.pairs || [];
            for (const pair of pairs) {
                const a = pair.bodyA;
                const b = pair.bodyB;
                if (!a || !b) continue;
                const bullet =
                    a.label === 'player-bullet' ? a : b.label === 'player-bullet' ? b : null;
                if (!bullet) continue;
                const other = bullet === a ? b : a;
                if (other.label !== 'monster' && other.label !== 'monster-hitbox') continue;
                const weapon = this.character.weapons;
                const active = weapon?.getActive();
                const bulletDamage = (bullet as any).bulletDamage ?? active?.damage;
                if (bulletDamage === undefined) continue;
                // Per-phase landing spots, so a phase change can move her by itself.
                this.monsterSystem.setBossSpawns(this.level.arenaSpawn);

                this.monsterSystem.applyBulletDamage(bulletDamage, other, bullet);
            }
        });

        // Inject the player's luck so applyBulletDamage uses the correct
        // crit chance from scene start. Defaults to 1 (10 % floor) when
        // the character spec omits luck.
        this.monsterSystem.setPlayerLuck(this.assets.character.luck ?? 1);

        // A level that forces a character (the arena hands everyone 鲸鲸) has to
        // remember who the player was, or the ending cannot hand them back.
        if (this.level.character) {
            const store = useGameStore.getState();
            if (
                store.characterBeforeArena === null &&
                store.selectedCharacterId !== this.level.character
            ) {
                store.setCharacterBeforeArena(store.selectedCharacterId);
            }
        }

        this.levelStartedAtMs = performance.now();

        // The comic opens the level once per save; 跳过 is there for replays.
        if (this.level.introComic) {
            const store = useGameStore.getState();
            if (!store.comicPlayedLevels.includes(this.id)) store.openComicIntro(this.id);
        }

        // Two monsters left and one of them hiding: point at it. Same chevrons as the arena
        // walk, so the player does not have to learn a second "go here" symbol.
        // Anyone can say something above their head; the Gemini juice egg uses this.
        // 角色说的话一律走**那条带边框的提示**（主人 2026-11-18：`一起收`）。
        //
        // 原来这里是把文字画在她头顶（`sayAbove`，从脖子处升起），好处是"谁在说"一目了然，
        // 坏处是样式和位置都跟其它台词不一样：没有框、字号还得跟着画布缩放算。
        // 收进框以后只剩一条通道，长句也由 CSS 自动折行。
        this.sayListener = (payload: { text: string; durationMs?: number }) => {
            sayQuip(payload.text);
        };
        EventBus.on(CHARACTER_SAY_EVENT, this.sayListener);

        // While a React dialog owns the keyboard (the nickname prompt), Phaser must stop
        // capturing keys or the letters never reach the input.
        this.typingListener = (typing: boolean) => {
            const keyboard = this.input.keyboard;
            if (keyboard) keyboard.enabled = !typing;
        };
        EventBus.on('ui-typing', this.typingListener);

        // Words on the floor: the hidden map explains itself where the player stands.
        this.floorTextObjects = drawFloorText(this, this.level.floorText);

        this.lastMonsterPointer = new LastMonsterPointer({
            scene: this,
            getPlayer: () => ({
                x: this.character.body.position.x,
                y: this.character.body.position.y,
            }),
            getMonsters: () => this.monsterSystem.remainingPositions(),
        });

        // The way out, once the map is clear. Same chevrons as the boss walk, and the
        // walk-in itself is the level's own travel trigger - one code path into the fight.
        if (this.level.exitArrow) {
            const arrow = this.level.exitArrow;
            if (arrow.orbit) {
                // Beside the player, like the last-monster pointer - not a signpost on the
                // floor. NOTE: no early `return` here. This is inside `create()`, and returning
                // skipped every subsystem wired below it - Atlantis never finished loading and
                // the game sat on the boot splash (`我重新开游戏已经进不去了`).
                this.guidePointer = new GuidePointer({
                    scene: this,
                    getPlayer: () => ({
                        x: this.character.body.position.x,
                        y: this.character.body.position.y,
                    }),
                    target: { x: arrow.x, y: arrow.y },
                    isActive: () => this.isLevelCleared(),
                });
            } else {
                this.exitArrow = new ExitArrow({
                    scene: this,
                    at: { x: arrow.x, y: arrow.y },
                    direction: arrow.direction,
                    isClear: () => this.isLevelCleared(),
                });
            }
        }

        // 一进这张图就发生的彩蛋（饭盆）：见 `lib/levels/arrival-eggs.ts`。
        // 放在这里而不是 update 里 —— 它和玩家位置无关，只和"进了这张图"有关。
        for (const action of arrivalActions(this.level)) {
            try {
                this.runInteractable(action);
            } catch (error) {
                recordCrash(error, 'scene:arrival-egg');
            }
        }

        // Wire one-shot region triggers — the beach lounger's iced juice, and the
        // Atlantean throne's hidden door.
        this.triggerSystem = new TriggerController(
            this.character,
            this.id,
            this.level.triggers,
            this.dropSystem,
            (id) => {
                const spec = this.assets.dropSpecs.get(id);
                if (!spec) throw new Error(`Unknown drop id: ${id}`);
                return spec;
            },
            // A travel trigger is a hidden door: no portal art, no fade art of
            // its own, just the same handoff the teleporter performs.
            // A travel trigger is a hidden door: no portal art, no fade art of
            // its own, just the same handoff the teleporter performs.
            (targetScene) => {
                useGameStore.getState().setCurrentLevelId(targetScene);
                useGameStore.getState().setEntitySnapshots({
                    player: undefined,
                    monsters: undefined,
                    drops: undefined,
                });
                void resolveAndRestart(targetScene);
            },
            undefined,
            (weaponId) => this.assets.weaponsById.get(weaponId),
            // `requiresClear` doors ask this: the Atlantean throne opens only after the four
            // waves are down.
            () => this.isLevelCleared(),
        );

        // Click targets painted into the art. Bound on the scene's input and
        // resolved through the camera, so a zone keeps matching the painting
        // after the camera has scrolled or zoomed.
        if (this.level.interactables && this.level.interactables.length > 0) {
            this.interactables = new InteractableController(this.level.interactables);
            this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                const hit = this.interactables?.handleClick(world.x, world.y);
                if (hit) this.runInteractable(hit.action);
            });
        }

        // Wire AudioController (subscribes to EventBus sfx:*/music:* events).
        this.audio = new AudioController(
            this,
            this.assets.sfxSpecs.values(),
            this.assets.musicSpecs.values(),
        );
        // Honk the level's chosen music, if any. If the level has no music
        // the global BGM from the previous scene is silenced — the
        // singleton survives scene transitions, so without this stop
        // any old music would keep playing into a silent scene.
        if (this.level.music) {
            EventBus.emit(MUSIC_EVENT(this.level.music));
        } else {
            EventBus.emit(MUSIC_STOP);
        }

        // The canvas is a fixed RENDER_VIEW_* window onto a level-sized world,
        // so the camera scrolls with the player instead of trying to fit the
        // whole level on screen. Bounds come from the level; for today's
        // 2752x1536 levels the world equals the view, so the clamp holds the
        // camera at 0,0 — the same centered shot the old `centerOn` gave.
        const camera = this.cameras.main;
        const { width, height } = this.level.imageSize;
        camera.setBounds(0, 0, width, height);
        const player = this.character.sprite;
        if (player) {
            camera.startFollow(player, true, RENDER_CAMERA_LERP, RENDER_CAMERA_LERP);
        } else {
            // Nothing to follow (shouldn't happen by create(), the runtime
            // hands us a sprite): keep the old one-shot framing instead of
            // leaving the camera loose.
            camera.centerOn(width / 2, height / 2);
        }

        // Per-frame monster tick & material Y-sorting & drop update.
        this.materialManager = new MaterialManager(this, this.level);

        // Optional Pixel Art Light & PostFX pipeline (enabled via PIXEL_LIGHTING_CONFIG.ENABLE or level YAML)
        if (isPixelLightingEnabled) {
            // 2. Apply Phaser 4 native filters: Pixelate + Quantize
            // (filters are scene-wide, applied unconditionally even during
            // tavern phase 1 — they're cheap and the look is the same
            // with or without a point light on the placeholder)
            const cameraAny = this.cameras.main as any;
            if (cameraAny.filters?.internal) {
                if (
                    PIXEL_LIGHTING_CONFIG.PIXELATE_AMOUNT > 0 &&
                    cameraAny.filters.internal.addPixelate
                ) {
                    cameraAny.filters.internal.addPixelate(PIXEL_LIGHTING_CONFIG.PIXELATE_AMOUNT);
                }
                if (PIXEL_LIGHTING_CONFIG.USE_QUANTIZE && cameraAny.filters.internal.addQuantize) {
                    cameraAny.filters.internal.addQuantize({
                        steps: [...PIXEL_LIGHTING_CONFIG.QUANTIZE_STEPS],
                        dither: PIXEL_LIGHTING_CONFIG.QUANTIZE_DITHER,
                        mode: 0,
                    });
                }
            }

            // The pointlight is created LAZILY (createPlayerLight below)
            // — only after the real character is loaded. During tavern
            // phase 1 the placeholder has no sprite/shadow, so a
            // pointlight following its body would render a green orb at
            // the spawn point with nothing visible inside it. We avoid
            // that by not creating the light until F confirm (or on
            // refresh when `selectedCharacterId` is already set).
            if (!this.level.tavern) {
                this.createPlayerLight();
            }
        }

        // Wire TeleporterController (code-drawn magic circle & scene transition).
        // Position callback reads `this.character` lazily so a tavern
        // character swap on confirm picks up the new body automatically.
        // Tavern exit is always unblocked; every other portal is gated on the
        // level's monsters unless it opts out with `requiresClear: false`.
        this.teleporterSystem = new TeleporterController(
            this,
            this.level.teleporters,
            this.id,
            () => (this.character?.body?.position ? this.character.body.position : null),
            (spec) => isPortalArmed(spec, this.isLevelCleared()),
            () => {
                // Auto quick save: the player has left the portal they arrived on, so
                // the snapshot is safe to reload without bouncing them back out.
                quickSave(t('saves.autoSaved'));
            },
            () => {
                // 清关存档（主人 2026-11-12）：最后一波怪倒下的那一刻，出口传送阵开始淡入，
                // 这时存一次。玩家关掉游戏再回来，直接从这个"已经清干净"的状态继续。
                quickSave(t('saves.autoSaved'));
            },
        );

        // ── Boss phase clear: ammunition on every phase, vitals from phase four on ──
        //
        // The owner: `每打过一个阶段，弹药自动补满（只有第四阶段打完时自动补满血蓝…）`. The
        // store action is what refills the guns in her hands as well as the mirror, so it is
        // the right door; a raw `set({ slots })` would only move the HUD.
        const onBossPhaseCleared = (payload: {
            id?: string;
            clearedIndex?: number;
            phaseCount?: number;
        }): void => {
            const reward = phaseClearReward(payload.clearedIndex ?? 0);
            if (reward.ammo) useGameStore.getState().refillAmmo();
            if (reward.vitals) {
                // `heal` clamps to the spec's maxima, so ask for more than anyone can hold.
                this.character?.heal(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
            }
        };
        EventBus.on(BOSS_PHASE_CLEAR_EVENT, onBossPhaseCleared);
        const dropBossPhaseRefill = (): void => {
            EventBus.removeListener(BOSS_PHASE_CLEAR_EVENT, onBossPhaseCleared);
        };
        this.events.once('shutdown', dropBossPhaseRefill);
        this.events.once('destroy', dropBossPhaseRefill);

        // The mysterious merchant: shows up on the junction of the four painted
        // blocks once the level is clean. Clicking her is the level's way out —
        // she emits `merchant-return-to-tavern` and the React layer hands the
        // player to the tavern (character select), which is the old tavern
        // button's job.
        if (usesMerchant(this.level)) {
            this.merchant = new MerchantController(
                this,
                this.level.imageSize,
                () => this.isLevelCleared(),
                epilogueCatFor(this.id, useGameStore.getState().endingCleared),
                this.level.merchantAt ?? null,
            );
        }

        // 每个子系统单独兜底。
        //
        // 原来整段只有一个 try：任何一处抛异常，排在它**后面**的东西这一帧就全不跑了
        // （掉落物、触发器、互动区、传送阵、存档时钟）。2026-11-15 手机上的
        // `BossArenaLoop.movePlayer → Cannot read property 'setPosition' of undefined`
        // 就是这么把「踩饭盆的提示」一起吞掉的 —— 饭盆的判定排在 bossArenaLoop 之后，
        // 而 boss 走位那一步每帧都在抛。
        //
        // 拆成一步一块以后，一处坏掉只坏它自己；异常照样写进崩溃日志（`recordCrash`），
        // 主循环还有 `installLoopGuard` 兜着，不会冻死。
        const guard = (label: string, run: () => void): void => {
            try {
                run();
            } catch (error) {
                recordCrash(error, `scene:update:${label}`);
            }
        };

        this.events.on('update', (_time: number, delta: number) => {
            guard('monsters', () => this.monsterSystem.update(this.time.now));

            guard('pointers', () => {
                const at = this.character.body.position;
                this.guidePointer?.update();
                this.lastMonsterPointer?.update();
                this.exitArrow?.update({ x: at.x, y: at.y });
                this.bossArena?.update({ x: at.x, y: at.y });
            });

            guard('spawner', () => {
                if (this.regionSpawner && this.character?.body) {
                    this.regionSpawner.update(
                        this.character.body.position.x,
                        this.character.body.position.y,
                    );
                }
            });

            // Watchdog: a monster that fell out of the painted world, or one left far behind
            // long ago, must not hold the exit shut - the level only clears when every living
            // monster is gone, so one unreachable straggler blocks it forever.
            guard('sweep', () => {
                if (!this.character?.body) return;
                this.monsterSystem.sweepLost(
                    this.character.body.position,
                    this.level.imageSize,
                    this.time.now,
                );
            });

            guard('debug', () => {
                this.pathDebugOverlay.refresh(
                    this.monsterSystem.getDebugMonsters(),
                    this.character.body,
                );
            });

            guard('drops', () => this.dropSystem.update());
            guard('triggers', () => this.triggerSystem.update(delta));

            // 走进去就触发的互动（饭盆）：每帧用玩家身体位置测一次，一次进关只放一次。
            guard('interactables', () => {
                if (!this.interactables) return;
                const p = this.character?.body?.position;
                if (!p) return;
                const step = this.interactables.walkInto(p.x, p.y);

                // 出生点就落在圈里时（初遇之地的饭盆原来就是这样：它那个 458 的外接方框
                // 把出生点 (3100,1600) 也框进去了），第一帧不许响 —— 主人 2026-11-15：
                // `我实际去踩碗啥都没发生`，因为提示在他刚进图时就放完了，之后一直站在圈里，
                // `walkInside` 从没被清空过。所以第一帧只登记、不放。
                if (!this.walkSeeded) {
                    this.walkSeeded = true;
                    if (step) this.walkInside.add(step.id);
                    return;
                }

                if (step) {
                    // 只在"踏进来的那一帧"触发；站在圈里不会每帧重放。
                    if (!this.walkInside.has(step.id)) {
                        this.walkInside.add(step.id);
                        this.runInteractable(step.action);
                    }
                } else {
                    // 走出去了，下次再进来还能响一次。
                    this.walkInside.clear();
                }
            });

            guard('quips', () => this.quipTicker?.update(delta));
            guard('materials', () => this.materialManager.update());
            // Monsters only run real A* near the camera — see PathfindingService.setFocus.
            guard('path-focus', () => this.monsterSystem.setPathFocus(this.cameras.main.worldView));
            guard('teleporters', () => this.teleporterSystem.update(delta));

            // Publish the character's world position so the React WeaponReplaceHub can anchor
            // next to them. 1 event per frame is fine — the hub only mounts while the
            // cap-replace UI is open, so when nothing's happening no listener is attached.
            guard('publish', () => {
                const body = this.character?.body;
                if (!body?.position) return;
                EventBus.emit('character-position', { x: body.position.x, y: body.position.y });
            });

            // Persist clock + entity snapshots to the UI store (1Hz).
            guard('save', () => this.tickSaveState());

            // Victory check: if this level is the final level in index.yaml, and all monsters
            // + pending waves are cleared, trigger victory!
            guard('victory', () => this.checkVictory());
        });

        // Tell the editor panel which scene this is. Both the EventBus
        // (for panel listeners mounted before create()) and the module-
        // level cache (for lazy-loaded panels mounting after create())
        // get the payload.
        const payload = { id: this.id, level: this.level };
        setCurrentLevel(payload);
        useGameStore.getState().setCurrentLevelId(this.id);
        useGameStore
            .getState()
            .setLevelTitle(pickText(this.level.title, this.level.titleZh) || this.id);
        const savedElapsedMs = useGameStore.getState().levelElapsedMs || 0;
        this.levelStartAt = this.time.now - savedElapsedMs;
        this.lastSavePushAt = this.time.now;
        useGameStore.getState().setLevelElapsedMs(savedElapsedMs);
        EventBus.emit('level-loaded', payload);
        EventBus.emit('current-scene-ready', this);

        // ── Tavern UI overlay ──────────────────────────────────────────
        // Two cases:
        //   1. First visit (selectedCharacterId === null): placeholder +
        //      TavernController (phase 1 NPC selection).
        //   2. Returning visit (selectedCharacterId !== null): player
        //      already chose — load the picked spec directly as the
        //      real character, skip the selection UI. The character
        //      renders immediately at the spawn point so the player
        //      doesn't see NPCs instead of their character on refresh.
        if (this.level.tavern) {
            const selectedId = useGameStore.getState().selectedCharacterId;
            if (selectedId !== null) {
                // Find the previously-selected spec from allCharacters
                // (or fall back to the default) and rebuild the scene's
                // character + subsystems around it. We clear the stale
                // `playerSnapshot` so the real character spawns at the
                // level's default (image center) instead of an off-world
                // position left behind by a previous session's
                // placeholder snapshot.
                const allChars = this.assets.allCharacters ?? [];
                const pickedSpec =
                    allChars.find((c) => c.id === selectedId) ?? this.assets.character;
                this.character.destroy();
                (this.assets as any).character = pickedSpec;
                if (pickedSpec.sprite) {
                    (this.assets as any).spriteCell = this.cellFor(pickedSpec.id);
                }
                // Clear only monster / drop snapshots — DO NOT clear
                // playerSnapshot. loadCharacter() reads it to restore
                // the player's last walked position on refresh; the
                // tavern refresh path should behave like every other
                // level and keep position continuity.
                useGameStore.setState({
                    activeMonstersSnapshot: undefined,
                    groundDropsSnapshot: undefined,
                });
                this.character = loadCharacter(
                    this,
                    this.level,
                    pickedSpec,
                    // Walking back in is not a new run: the guns in the store's slots are
                    // what she actually carries. Passing the YAML hotbar here deleted the
                    // cat's rifle the moment the player returned to the tavern.
                    restoredWeaponsFor(
                        pickedSpec,
                        this.assets.weaponsById,
                        useGameStore.getState().slots,
                    ),
                    {
                        weaponsById: this.assets.weaponsById,
                        spriteScaleMultiplier: actorScaleFor(this.id),
                        // Walking back into the tavern through its paired portal
                        // keeps the character and lands by that portal.
                        spawnOverride: consumeTeleportArrival(this.id) ?? undefined,
                    },
                );
                this.applyHeldMaxBonus();
                this.monsterSystem.setPlayerBody(this.character.body);
                this.monsterSystem.setPlayerLuck(pickedSpec.luck ?? 1);
                this.dropSystem.setCharacter(this.character);
                useGameStore.getState().setHubsVisible(true);
                // tavernCleared is already true from the previous run.
                // Mount the pointlight now that the real character is
                // loaded — phase 1 was deliberately lightless because the
                // placeholder has no sprite/shadow to float around.
                this.createPlayerLight();

                // Spawn a pickup-only TavernController so the
                // weapon-replace-hub still works after refresh (the
                // default branch skips it because the player already
                // chose a character).
                this.tavernController = new TavernController(
                    this,
                    this.level,
                    this.assets,
                    () => {
                        /* no-op — selection phase is not active */
                    },
                    'pickup',
                );
            } else {
                this.tavernController = new TavernController(
                    this,
                    this.level,
                    this.assets,
                    (selectedSpec: CharacterSpec, spawnPos: { x: number; y: number }) => {
                        this.character.destroy();
                        (this.assets as any).character = selectedSpec;
                        if (selectedSpec.sprite) {
                            (this.assets as any).spriteCell = this.cellFor(selectedSpec.id);
                        }
                        // HER hotbar, not the scene's. `this.assets.weapons` is the
                        // tavern's default girl (DeepSeek), so passing it handed every
                        // picked character the whale cannon.
                        this.character = loadCharacter(
                            this,
                            this.level,
                            selectedSpec,
                            startingWeaponsFor(selectedSpec, this.assets.weaponsById),
                            {
                                weaponsById: this.assets.weaponsById,
                                spawnOverride: spawnPos,
                                spriteScaleMultiplier: actorScaleFor(this.id),
                            },
                        );
                        // Rewire subsystems to the freshly-spawned
                        // character's body / runtime. monsterSystem
                        // tracks the body for player-hit detection;
                        // dropSystem holds the runtime reference for
                        // magnet + pickup collision + heal/ ammo
                        // callbacks. Both were captured against the
                        // placeholder.
                        this.applyHeldMaxBonus();
                        this.monsterSystem.setPlayerBody(this.character.body);
                        this.monsterSystem.setPlayerLuck(selectedSpec.luck ?? 1);
                        this.dropSystem.setCharacter(this.character);
                        // Phase 1 hidden the React HUDs
                        // (CharacterHud.setVisible → setHubsVisible
                        // (false)); restore them for phase 2 so the
                        // new character's weapon/HP/EXP panels come
                        // back.
                        useGameStore.getState().setHubsVisible(true);
                        useGameStore.getState().setTavernCleared(true);
                        // Mount the pointlight now that the real
                        // character body is in place. Phase 1 was
                        // deliberately lightless so the placeholder's
                        // invisible body wouldn't render a green orb.
                        this.createPlayerLight();
                    },
                );
            }

            // (Auto-swap on cap lives in the dropSystem's onWeaponPickup
            // callback above — no separate hub event handler needed.)
        }
    }

    /**
     * Draw the level's ground: a tilemap layer when the level declares a
     * tilemap, otherwise the painted background image.
     *
     * Both cover exactly `imageSize` in the same coordinate space, so the
     * rest of the scene never has to know which one it got. A declared
     * tilemap that cannot be drawn warns and leaves the level playable
     * rather than crashing it.
     */
    /**
     * 这张贴图比本机 GPU 的贴图上限还大吗？
     *
     * 超限时 Phaser 的上传会静默失败：怪（小贴图）都在，房间却是全黑。2026-11-13 手机版
     * 就是这么发的 1.5.1 —— bodies 打进包里的背景还是 5504px，而手机的
     * `gl.MAX_TEXTURE_SIZE` 是 4096。下采样脚本已经修好（`scripts/downscale-scenes.py`），
     * 这里留一条 ERROR：下次真再出这种事，控制台会直接说是哪张图、超多少。
     */
    private warnIfAboveTextureLimit(key: string, frame?: { width: number; height: number }): void {
        if (!frame) return;
        const gl = (
            this.game?.renderer as unknown as { gl?: { getParameter: (p: number) => unknown } }
        )?.gl;
        const MAX_TEXTURE_SIZE = 0x0d33;
        const limit =
            gl && typeof gl.getParameter === 'function'
                ? Number(gl.getParameter(MAX_TEXTURE_SIZE))
                : NaN;
        if (!Number.isFinite(limit) || limit <= 0) return;
        const edge = Math.max(frame.width, frame.height);
        if (edge <= limit) return;
        console.error(
            `[ground] ${key} 是 ${frame.width}x${frame.height}，超过本机贴图上限 ${limit}，` +
                `这张图会显示成黑屏。手机包需要先跑 scripts/downscale-scenes.py。`,
        );
    }

    private createGround(tint?: number): void {
        const tilemap = this.level.tilemap;
        if (!tilemap) {
            // Every layer is stretched back to the space it is authored for: a whole painting
            // fills `imageSize`, a block fills one cell of the grid. The mobile bundle caps
            // textures at 4096 (see scripts/downscale-scenes.py), so a 4096 px file drawn 1:1
            // would leave a black gutter - a third of the room for a single painting, a 1488 px
            // seam between blocks in 星空图书馆.
            const drawSize = groundDisplaySize(this.level);
            for (const layer of groundLayers(this.id, this.level)) {
                const image = this.add.image(layer.x, layer.y, layer.key).setOrigin(0, 0);
                image.setDisplaySize(drawSize.width, drawSize.height);
                if (tint !== undefined) image.setTint(tint);
                this.warnIfAboveTextureLimit(layer.key, image.frame);
            }
            return;
        }

        const resources = tilemapResourcesFor(this.id, tilemap);
        const map = this.make.tilemap({ key: resources.mapKey });
        const tilesetName = map.tilesets[0]?.name;
        const layerName = map.layers[0]?.name;
        if (!tilesetName || !layerName) {
            console.warn(`Level ${this.id}: tilemap has no tileset or layer to draw`);
            return;
        }

        const tileset = map.addTilesetImage(tilesetName, resources.atlasKey);
        const layer = tileset ? map.createLayer(layerName, tileset) : null;
        if (!layer) {
            console.warn(`Level ${this.id}: could not create tilemap layer "${layerName}"`);
            return;
        }
        // Phaser v4 types createLayer as TilemapLayer | TilemapGPULayer, and
        // only the CPU layer has a tint API — hence the `in` check rather
        // than a signature that leaks the union to the caller.
        if (tint !== undefined && 'setTint' in layer) {
            layer.setTint(tint);
        }

        // The map's own pixel size is what the art claims; everything else in
        // the level (walls, spawns, physics) is authored against imageSize, so
        // a mismatch means the two would drift apart.
        const width = map.widthInPixels;
        const height = map.heightInPixels;
        if (width !== this.level.imageSize.width || height !== this.level.imageSize.height) {
            console.warn(
                `Level ${this.id}: tilemap is ${width}x${height} but imageSize is ` +
                    `${this.level.imageSize.width}x${this.level.imageSize.height}`,
            );
        }
    }

    /** Texture keys this scene's preload registered — released on shutdown. */
    private readonly loadedTextureKeys = new Set<string>();

    private isShutdown = false;

    /**
     * 玩家此刻站在哪些 walk 互动里。
     *
     * 原来这里是"一次进关只放一次"，于是第二次踩饭盆彻底沉默——主人 2026-11-14 报的
     * `踩到那个饭盆上没触发白米饭饭盆彩蛋提示词` 就是这个：第一次那句台词只有 15px，他没注意，
     * 再走过去就什么都不会发生了。改成按"踏进来那一刻"触发：每帧都命中也不会刷屏，走出去再
     * 进来可以再读一遍，道具不会重复进包（`runInteractable` 里判了背包）。
     */
    private readonly walkInside = new Set<string>();
    /** 第一帧只登记不触发：出生点落在互动圈里时不该当成"踩进来"（2026-11-15）。 */
    private walkSeeded = false;

    /** What a click target does. One line per action; add as needed. */
    private runInteractable(action: string): void {
        if (action === 'dev-mail') {
            useGameStore.getState().openDevCabin();
            return;
        }
        if (action === 'cat-shop') {
            this.openCatShop();
            return;
        }
        if (action === RICE_BOWL_ACTION) {
            // 白米饭: 走进铁盆，先读 第七世 那句台词，再把饭盆收进背包。
            // 主人：`走进黄圈就自动获得（不用按键），背包里立刻多一个道具`。
            //
            // 台词**每次踏进来都说**，道具只在第一次进包：主人 2026-11-14 报"提示词没触发"，
            // 实际是第一次那句一闪而过（当时只有 15px），第二次走过就彻底沉默。
            const bowlState = useGameStore.getState();
            const held = bowlState.inventory.some((slot) => slot.dropId === RICE_BOWL_DROP_ID);
            bowlState.showNotice(held ? t('easter.riceBowlHeld') : t('easter.riceBowl'));
            if (!held) bowlState.addInventoryItem(RICE_BOWL_DROP_ID, 1);
            return;
        }
        console.warn('[interactable] no handler for action: ' + action);
    }

    /**
     * 猫猫商店 — the cabin cat opens the very same shop the merchant carries.
     *
     * The first click of a save also hands over an assault rifle. It goes straight into
     * her hands: the arc-delivery version needed five things to line up at once (drop
     * spec, weapon spec, click zone, a sprite on the spawned drop, and a pickup after
     * landing) and did nothing at all whenever one was missing. The rifle is the easter
     * egg; the flight was decoration.
     */
    private openCatShop(): void {
        const state = useGameStore.getState();
        const firstOfSave = !state.catShopGiftGiven;
        state.openCatShop();
        EventBus.emit(MERCHANT_SHOP_EVENT);
        if (!firstOfSave) return;

        const result = giveCatGift({
            weaponsById: this.assets.weaponsById,
            // Adds to the next empty slot. `pickUpWeapon` only switches to a weapon she
            // already carries - it was the reason this gift did nothing at all.
            addWeapon: (id) => this.character.tryPickupWeaponById(id, this.assets.weaponsById),
            refresh: () => this.character.refreshHud(),
            warn: (message, detail) => console.warn(`[cat-shop] ${message}`, detail),
        });

        const gift = this.assets.weaponsById.get(CAT_SHOP_GIFT_WEAPON_ID);
        const giftName = gift ? pickText(gift.name, gift.nameZh) : '突击步枪';
        const say = (line: string) => useGameStore.getState().showNotice(line);
        // Whatever happened, say it. A silent gift is indistinguishable from a broken one.
        if (result === 'granted') {
            say(`猫猫塞给你一把${giftName}`);
        } else if (result === 'merged') {
            say(`猫猫又塞给你一把${giftName}，两把合成一把（+1 级）`);
        } else if (result === 'capped') {
            say(`猫猫叼来了${giftName}，可你手上拿不下了`);
        }
    }

    /** Real cell size for a character id, falling back to the scene's own. */
    private cellFor(characterId: string): { width: number; height: number } {
        return this.assets.characterCells?.[characterId] ?? this.assets.spriteCell;
    }

    shutdown(): void {
        // Phaser fires both 'shutdown' AND 'destroy' on some paths
        // and only 'destroy' on scene.remove(). The once() bindings
        // above would still run this twice in the first case if the
        // subsystems aren't idempotent — guard so each subsystem is
        // torn down exactly once.
        if (this.isShutdown) return;
        this.isShutdown = true;
        this.releaseLoadedTextures();
        this.tavernController?.destroy();
        // MonsterController owns the `skill:dragon-roar` listener and every
        // monster body / sprite / tween. Not destroying it left one live
        // listener per level load, so a later E press woke handlers that
        // pointed at a torn-down scene.
        // The arena walk owns a boss:phase-cleared listener and a live arrow; without this
        // teardown a later level would answer the previous boss's phases.
        for (const label of this.floorTextObjects) label.destroy();
        this.floorTextObjects = [];
        if (this.typingListener) EventBus.removeListener('ui-typing', this.typingListener);
        this.typingListener = undefined;
        if (this.sayListener) EventBus.removeListener(CHARACTER_SAY_EVENT, this.sayListener);
        this.sayListener = undefined;
        this.guidePointer?.destroy();
        this.guidePointer = undefined;
        this.lastMonsterPointer?.destroy();
        this.lastMonsterPointer = undefined;
        this.exitArrow?.destroy();
        this.exitArrow = undefined;
        this.bossArena?.destroy();
        this.bossArena = undefined;
        this.monsterSystem?.destroy();
        this.teleporterSystem?.destroy();
        this.merchant?.destroy();
        this.merchant = undefined;
        // DropController owns the `inventory:use` listener. Leaving it bound meant every
        // level load added another one, and one click on a bag item then consumed as many
        // items as levels visited (`不是一个一个扣的，一次扣了好多个`).
        // Each teardown is isolated: a throw from one must not skip the others and leave
        // listeners (and the whole scene) half alive.
        try {
            this.dropSystem?.destroy();
        } catch (error) {
            console.warn('[scene] drop teardown failed', error);
        }
        try {
            this.triggerSystem?.destroy();
        } catch (error) {
            console.warn('[scene] trigger teardown failed', error);
        }
        // The character owns global EventBus listeners (the shop's paid refill, the upgrade
        // ladder, the HP cheat). Nothing used to tear it down on a scene swap, so every level
        // change left another dead controller subscribed: the merchant's refill then healed the
        // FIRST level's ghost instead of the girl on screen (`扣钱但状态没回满`), and that ghost
        // threw on every heal because its scene was gone.
        try {
            this.character?.destroy();
        } catch (error) {
            console.warn('[scene] character teardown failed', error);
        }
        this.audio?.destroy();
        this.pathDebugOverlay?.destroy();
    }

    /**
     * Hand back every texture this scene loaded.
     *
     * Phaser's TextureManager is game-wide, so what a scene loads outlives
     * the scene. That is why background keys are namespaced per level (see
     * preload): without releasing them the next level's `background` key
     * would still resolve to the old image. It also means every level swap
     * leaves its background and sprite sheets resident — ~17 MB a scene
     * today, 145 MB for the maps the camera now scrolls across.
     */
    private releaseLoadedTextures(): void {
        for (const key of releasableTextureKeys(this.loadedTextureKeys)) {
            if (this.textures.exists(key)) this.textures.remove(key);
        }
        this.loadedTextureKeys.clear();
    }

    private isCheckingVictory = false;

    /**
     * 一只怪倒下之后该做的事：收尾判定、道具破拆、掉战利品。
     *
     * 从 `onMonsterDied` 里抽出来，是为了能单独包 try/catch：这条链路由死亡动画的
     * `delayedCall` 触发，跑在场景 update 的保护层之外。
     */
    private spawnDeathLoot(monster: Monster): void {
        // The boss's death is the end of the story, not a clear-map
        // victory: hand over to the settlement sequence and stop.
        const isBoss = Boolean(this.level.boss) && monster.spec.id === this.level.boss?.monsterType;
        if (isBoss) {
            const runMs = Math.max(0, Math.round(performance.now() - this.levelStartedAtMs));
            // 四张图是一条链，四关的用时都要记：前三关的形态倒下只是清关，第四关才收尾。
            // 少记前三关，结算页那行「用时」就只剩最后一张的时长
            // （主人 2026-11-16：`判定逻辑自动挪到了最后一个图，不准确了`）。
            const chapterMs = useGameStore.getState().recordLevelClear(this.id, runMs);
            if (bossSettlementDue(this.level.bossPhase)) {
                useGameStore.getState().openSettlement(chapterMs);
                return;
            }
        }
        // Scenery, not a creature: an opened prop stays open, which is what keeps the tavern
        // ornament's black hole and the portal it hides revealed for good.
        if (monster.spec.prop && monster.spec.id) {
            useGameStore.getState().markPropBroken(propKey(this.id, monster.spec.id));
        }
        const mp = monster.body.position;
        const rolled = rollDrops(monster.spec.drops, (dropId) => {
            const spec = this.assets.dropSpecs.get(dropId);
            if (!spec) {
                throw new Error(`Unknown drop id: ${dropId}`);
            }
            return spec;
        });
        for (const r of rolled) {
            this.dropSystem.spawn(r.spec as never, mp.x, mp.y);
        }
    }

    private checkVictory(): void {
        const store = useGameStore.getState();
        if (store.isVictory || store.isDead || this.isCheckingVictory) return;
        if (this.level.tavern) return;

        this.isCheckingVictory = true;
        // Verify if this is the final level in index.yaml
        fetchLevelIndex()
            .then((indexManifest) => {
                const levels = indexManifest.levels;
                if (!levels || levels.length === 0) return;
                const lastLevelId = levels[levels.length - 1];
                if (this.id === lastLevelId) {
                    if (this.isLevelCleared()) {
                        // Trigger Victory! Scene keeps running so the
                        // player can walk to the teleporter and return
                        // to the tavern — the React overlay is just
                        // confetti, not a modal. AudioController
                        // subscribes to `sfx:victory-fanfare` and
                        // fires once. Throttled to 5s min gap.
                        store.setVictory(true);
                        EventBus.emit(SFX_EVENT('victory-fanfare'), { throttleMs: 5000 });
                    }
                }
            })
            .catch(() => {
                /* ignore manifest fetch error */
            })
            .finally(() => {
                this.isCheckingVictory = false;
            });
    }

    /**
     * Mount the player-following pointlight and register a per-frame
     * listener that tracks the current `this.character.body.position`.
     * Called once after the real character is loaded — non-tavern
     * scenes at the end of `create()`, tavern scenes after F confirm
     * (or on refresh when `selectedCharacterId` is already set).
     *
     * Why lazy: during tavern phase 1, the placeholder has no sprite
     * or shadow to anchor the light to. A static-body-following
     * pointlight would render a green orb at the spawn point with a
     * dark centre (the "ghost" character effect). Deferring creation
     * until the real character loads eliminates that visual.
     *
     * The listener closes over `playerLight` and reads
     * `this.character.body` each frame, so character swaps on confirm
     * don't need to re-register — the body reference updates
     * transparently.
     */
    private createPlayerLight(): void {
        const body = this.character?.body;
        if (!body?.position) return;
        const playerLight = (this.add as any).pointlight(
            body.position.x,
            body.position.y,
            PIXEL_LIGHTING_CONFIG.LIGHT_COLOR,
            PIXEL_LIGHTING_CONFIG.LIGHT_RADIUS_X,
            PIXEL_LIGHTING_CONFIG.LIGHT_INTENSITY,
            PIXEL_LIGHTING_CONFIG.LIGHT_ATTENUATION,
        );
        if (playerLight?.setScale) {
            playerLight.setScale(
                1.0,
                PIXEL_LIGHTING_CONFIG.LIGHT_RADIUS_Y / PIXEL_LIGHTING_CONFIG.LIGHT_RADIUS_X,
            );
        }
        playerLight.setDepth?.(DEPTH.LIGHT);
        this.events.on('update', () => {
            const liveBody = this.character?.body;
            if (liveBody?.position && playerLight) {
                playerLight.setPosition(liveBody.position.x, liveBody.position.y);
            }
        });
    }

    /**
     * Push everything the save file needs — level clock plus player /
     * monster / drop snapshots — in a single store write, throttled to
     * 1Hz.
     *
     * One write per second is the point, not an accident: the store is
     * wrapped in zustand's `persist`, which serialises the whole
     * partialized state and writes localStorage synchronously on every
     * `set`. At the old 5Hz clock rate that meant JSON.stringify-ing the
     * live monster list five times a second on the main thread. 1Hz also
     * matches the HUD clock's own MM:SS resolution, so nothing is lost.
     */
    private tickSaveState(): void {
        const now = this.time.now;
        if (now - this.lastSavePushAt < 1000) return;
        this.lastSavePushAt = now;

        const playerPos = this.character?.body?.position;
        useGameStore.getState().setEntitySnapshots({
            player: playerPos
                ? { x: Math.round(playerPos.x), y: Math.round(playerPos.y) }
                : undefined,
            monsters: this.monsterSystem?.getSnapshot(),
            drops: this.dropSystem?.getSnapshot(),
            elapsedMs: now - this.levelStartAt,
        });
    }
}
