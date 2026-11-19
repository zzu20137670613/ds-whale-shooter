/**
 * src/game/drops/drop.ts
 * --------------------------------------------------------------------------
 * Drops module — entity + controller in one file.
 *
 *   - DropInstance: a single drop on the map (sensor body + visual).
 *   - DropController: scene-side orchestrator. Spawns static drops at
 *     scene init + monster-death drops, and applies pickup effects on
 *     collisionstart. Pure effect dispatch lives in `./logic.ts`.
 */

import { HP_SHARD_HEAL, HP_SHARD_ID, shouldAutoUseHpShard } from '@/lib/drops/auto-use';
import {
    AUTO_RESTORE_INTERVAL_MS,
    nextRestoreArmed,
    restoreSlotIndex,
    type RestoreKind,
} from '@/lib/drops/auto-restore';
import { appliesOnPickup, effectWouldDoSomething } from '@/lib/drops/use-check';
import { maxBonusOf } from '@/lib/drops/held-bonus';
import { pickupNoticeApplies } from '@/lib/drops/effect-text';
import { pickText } from '@/locales';
import * as Phaser from 'phaser';

import type { CharacterRuntime } from '@/game/characters/character';
import {
    CAT,
    DROP_CONFIG,
    SFX_EVENT,
    type TokenPillarTone,
    WALL_PLAYER_MASK,
    DROP_USE_DEDUPE_MS,
} from '@/lib/constants';
import { DROP_FULL_RESTORE_AMOUNT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { isWithinView } from '@/lib/props/activation';
import type { Box } from '@/lib/props/activation';
import type { DropSpec } from '@/lib/drops';
import { fetchDrop } from '@/lib/drops/loader';
import { dropIdleFrame } from '@/lib/drops/frames';
import type { DropSpawn } from '@/lib/levels/types';
import type { WeaponSpec } from '@/lib/weapons';

import { useGameStore } from '@/store/game-store';

import { CHARACTER_SAY_EVENT, INVENTORY_USE_EVENT } from '@/lib/inventory/events';
import { juiceEasterEgg } from '@/lib/drops/easter-eggs';

import { planDropEffect } from './logic';
import { grantTokenShield } from '@/lib/drops/token-shield-store';
import { beamToneFor, createTokenBeam } from '@/game/drops/token-beam';

/** Shown when a bag item would change nothing; the item stays in the bag. */
const NOTHING_TO_DO_NOTICE = '现在用不上，先留着';

/**
 * Shown when the bag drinks for itself (see lib/drops/auto-restore.ts).
 *
 * An automatic heal that happens silently is indistinguishable from a shard vanishing, so
 * the notice names which pool it topped up.
 */
const AUTO_RESTORE_NOTICES: Readonly<Record<RestoreKind, string>> = {
    hp: '生命碎片自动使用',
    sp: '灵力碎片自动使用',
};

/**
 * 上膛了却没有对应的药：这也要说一句。
 *
 * 沉默会被读成"自动补给坏了"——主人 2026-11-14 就为此报过一次（`自动使用蓝药没提示`，
 * 实际是提示有的、他没看见；但反过来"没药所以什么都没发生"才是真正无声的那种情况）。
 * 每上一次膛只提醒一次，免得血量长期低于线时刷屏。
 */
const AUTO_RESTORE_MISSING_NOTICES: Readonly<Record<RestoreKind, string>> = {
    hp: '没有生命碎片，自动补给跳过',
    sp: '没有灵力碎片，自动补给跳过',
};

// ─── Entity ──────────────────────────────────────────────────────────────

export function textureKey(spec: DropSpec): string {
    return `drop:${spec.id}`;
}

export function animKey(spec: DropSpec, track: string): string {
    return `drop:anim:${spec.id}:${track}`;
}

export function loadDropAssets(scene: Pick<Phaser.Scene, 'load'>, specs: Iterable<DropSpec>): void {
    for (const spec of specs) {
        if (!spec.sprite) continue;
        const key = textureKey(spec);
        const url = spec.sprite.texture.startsWith('/')
            ? spec.sprite.texture
            : `/${spec.sprite.texture}`;

        scene.load.spritesheet(key, url, {
            frameWidth: 64,
            frameHeight: 64,
        });
    }
}

export function createDropAnims(
    scene: Pick<Phaser.Scene, 'anims'>,
    specs: Iterable<DropSpec>,
): void {
    if (!DROP_CONFIG.ENABLE_ANIMATION) return;
    for (const spec of specs) {
        if (!spec.sprite || !spec.anims) continue;
        const key = textureKey(spec);
        for (const [track, animSpec] of Object.entries(spec.anims)) {
            const trackKey = animKey(spec, track);
            if (scene.anims.exists(trackKey)) scene.anims.remove(trackKey);

            const [start, end] = animSpec.frames;
            const frames: Phaser.Types.Animations.AnimationFrame[] = [];
            for (let i = start; i <= end; i++) {
                frames.push({ key, frame: i });
            }
            scene.anims.create({
                key: trackKey,
                frames,
                frameRate: animSpec.frameRate,
                repeat: animSpec.repeat ?? -1,
            });
        }
    }
}

export class DropInstance {
    readonly spec: DropSpec;
    readonly body: MatterJS.BodyType;
    readonly rect: Phaser.GameObjects.Rectangle;
    readonly sprite?: Phaser.GameObjects.Sprite;
    /** When this drop is a weapon pickup, override the spec's
     *  `effect.weaponId` with this so the on-pickup callback resolves
     *  to the actual weapon the player is standing on (multiple
     *  dropSpawns can share one generic drop spec). Also used by the
     *  visual layer — when present, the weapon's own `visual.texture`
     *  replaces the spec's spritesheet so the drop on the ground looks
     *  like the weapon you pick up. */
    readonly weaponSpec?: WeaponSpec;
    private arcGraphics?: Phaser.GameObjects.Graphics;
    /** 词元盾的地面光柱（主人：`词元盾在地上时给加个光柱，显示出与普通掉落的与众不同`）。 */
    private readonly tokenPillarTone: TokenPillarTone;
    private tokenPillar?: Phaser.GameObjects.Sprite;
    private tokenGlow?: Phaser.GameObjects.Ellipse;

    taken = false;
    isLanded = true;
    /** 这一处的"只给一次"标记（`dropSpawns[].onceKey`）。怪物掉落永远是 undefined。 */
    readonly onceKey?: string;
    isAttracting = false;
    /**
     * True when the cap-replace hub dismissed this drop without
     * consuming it. The magnet stays disengaged until the player
     * walks far enough away to "release" the drop — otherwise the
     * magnet would re-engage every frame the player is in range
     * (dist <= RADIUS stays true even after pickup was rejected)
     * and the pickup SFX would loop forever. Cleared when
     * dist > RADIUS * 1.5 in the magnet update.
     */
    rejected = false;

    constructor(
        scene: Phaser.Scene,
        spec: DropSpec,
        x: number,
        y: number,
        isFromMonster = false,
        weaponSpec?: WeaponSpec,
        /** 关卡的光柱深浅（`tokenPillarTone`）。 */
        tokenPillarTone: TokenPillarTone = 'bright',
        /** 只给一次的摆位标记；捡走之后不再生成（见 `DropSpawnSchema.onceKey`）。 */
        onceKey?: string,
    ) {
        this.spec = spec;
        this.onceKey = onceKey;
        this.weaponSpec = weaponSpec;
        this.tokenPillarTone = tokenPillarTone;

        // If from monster, calculate wall-clamped landing position for parabolic drop
        let targetX = x;
        let targetY = y;

        if (isFromMonster) {
            this.isLanded = false;
            const popConfig = DROP_CONFIG.PARABOLA;
            const angle = Math.random() * Math.PI * 2;
            const dist =
                popConfig.POP_RADIUS_MIN +
                Math.random() * (popConfig.POP_RADIUS_MAX - popConfig.POP_RADIUS_MIN);

            const desiredX = x + Math.cos(angle) * dist;
            const desiredY = y + Math.sin(angle) * dist;

            // Raycast against walls using Matter to prevent landing inside/beyond walls
            const bodies = scene.matter.world.getAllBodies().filter((b) => {
                const cat = b.collisionFilter?.category ?? 0;
                return (cat & WALL_PLAYER_MASK) !== 0;
            });

            const raycast = (Phaser as any).Physics.Matter.Matter.Query.ray(
                bodies,
                { x, y },
                { x: desiredX, y: desiredY },
            );

            if (raycast && raycast.length > 0) {
                // Ray hit a wall — land slightly before the hit point
                const hit = raycast[0];
                const hitFraction = Math.max(0, hit.fraction - 0.1);
                targetX = x + (desiredX - x) * hitFraction;
                targetY = y + (desiredY - y) * hitFraction;
            } else {
                targetX = desiredX;
                targetY = desiredY;
            }
        }

        // Initialize Matter sensor body at landing target position
        this.body = scene.matter.add.circle(targetX, targetY, spec.visual.size / 2, {
            label: 'drop',
            isSensor: true,
            collisionFilter: {
                category: CAT.CHARACTER,
                mask: CAT.CHARACTER,
            },
        });

        // Debug / fallback rectangle (hidden when sprite is present)
        this.rect = scene.add.rectangle(
            targetX,
            targetY,
            spec.visual.size,
            spec.visual.size,
            spec.visual.tint,
            0.4,
        );
        this.rect.setStrokeStyle(1.5, 0x22c55e, 1);
        this.rect.setVisible(false);

        // 光柱：一块会说话的地面标记，一眼就能从普通掉落里认出来。
        // 颜色由物品自己定（`beam`）：金=词元盾，紫=白龙獠牙，白=未至之境预留。
        // 主人 2026-11-14：`现在的光柱，有点"1毛特效了"`，要「传奇」那种 5 毛特效 —— 内芯/
        // 边光/上升光带/火花/双旋转符环/冲击波全在序列帧里，这里只负责摆和播。
        const beamTone = beamToneFor(
            spec.beam,
            weaponSpec?.beam,
            this.tokenPillarTone,
            spec.effect.type === 'token-shield',
        );
        if (beamTone) {
            const beam = createTokenBeam(scene, targetX, targetY, beamTone);
            this.tokenPillar = beam.beam;
            this.tokenGlow = beam.glow;
        }

        if (
            weaponSpec &&
            weaponSpec.visual?.texture &&
            scene.textures.exists(weaponSpec.visual.texture)
        ) {
            // Weapon pickups show the weapon's own in-hand texture so the
            // drop on the ground is visually identical to the gun you're
            // about to pick up. No spritesheet / anim — weapons are
            // single-frame static images.
            //
            // Scale: use the weapon's own `visual.scale` from the YAML so
            // every weapon renders at its hand-tuned size on the ground
            // (arcana-staff at 0.16 stays tiny, plasma-sword at 0.16
            // stays tiny, etc). The × GROUND_MULTIPLIER bump makes the
            // drop legible at world zoom — the in-hand scale is sized
            // for a tiny sprite anchored to a character body, the
            // ground drop needs to be a readable prop on its own.
            const spriteObj = scene.add.image(
                isFromMonster ? x : targetX,
                isFromMonster ? y : targetY,
                weaponSpec.visual.texture,
            );
            spriteObj.setDepth(Math.round(targetY));
            const pickupScale = weaponSpec.visual.scale ?? 0.16;
            spriteObj.setScale(pickupScale * DROP_CONFIG.WEAPON_PICKUP_SCALE_MULTIPLIER);
            this.sprite = spriteObj as unknown as Phaser.GameObjects.Sprite;
        } else if (spec.sprite && scene.textures.exists(textureKey(spec))) {
            const idleAnimKey = animKey(spec, 'idle');
            const spriteObj = scene.add.sprite(
                isFromMonster ? x : targetX,
                isFromMonster ? y : targetY,
                textureKey(spec),
            );
            spriteObj.setDepth(Math.round(targetY));
            if (spec.sprite.scale) spriteObj.setScale(spec.sprite.scale);

            if (DROP_CONFIG.ENABLE_ANIMATION && scene.anims.exists(idleAnimKey)) {
                spriteObj.play(idleAnimKey);
            } else {
                // Not frame 0: all four drops share one 4x4 atlas, so frame 0 is
                // the chicken leg for every one of them. Ask the spec where its
                // own idle pose starts.
                spriteObj.setFrame(dropIdleFrame(spec));
            }
            this.sprite = spriteObj;
        }

        // Play parabolic jump animation if dropped by monster
        if (isFromMonster && this.sprite) {
            this.playParabolicArc(scene, x, y, targetX, targetY);
        }
    }

    private playParabolicArc(
        scene: Phaser.Scene,
        startX: number,
        startY: number,
        targetX: number,
        targetY: number,
    ): void {
        const popConfig = DROP_CONFIG.PARABOLA;

        // Draw translucent neutral gray parabolic arc curve
        const graphics = scene.add.graphics();
        graphics.setDepth(Math.round(targetY) - 1);
        this.arcGraphics = graphics;

        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2 - popConfig.ARC_HEIGHT;

        const curve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(startX, startY),
            new Phaser.Math.Vector2(midX, midY),
            new Phaser.Math.Vector2(targetX, targetY),
        );

        graphics.lineStyle(popConfig.LINE_WIDTH, popConfig.LINE_COLOR, popConfig.LINE_ALPHA);
        curve.draw(graphics);

        // Tween drop sprite along the curve
        const progressObj = { t: 0 };
        scene.tweens.add({
            targets: progressObj,
            t: 1,
            duration: popConfig.DURATION,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                if (!this.sprite) return;
                const pt = curve.getPoint(progressObj.t);
                this.sprite.setPosition(pt.x, pt.y);
                this.sprite.setDepth(Math.round(pt.y));
                this.rect.setPosition(pt.x, pt.y);
            },
            onComplete: () => {
                this.isLanded = true;
                if (this.sprite) {
                    this.sprite.setPosition(targetX, targetY);
                    this.sprite.setDepth(Math.round(targetY));
                }
                this.rect.setPosition(targetX, targetY);

                // Fade out and destroy trajectory line after landing
                if (this.arcGraphics) {
                    scene.tweens.add({
                        targets: this.arcGraphics,
                        alpha: 0,
                        duration: 150,
                        onComplete: () => {
                            this.arcGraphics?.destroy();
                            this.arcGraphics = undefined;
                        },
                    });
                }
            },
        });
    }

    destroy(scene: Phaser.Scene): void {
        this.tokenPillar?.destroy();
        this.tokenGlow?.destroy();
        // Teardown can arrive after the scene's Matter world is already gone (that is what
        // `restartAtTavern` does). Touching `world.remove` then threw
        // `Cannot read properties of null (reading 'remove')` from inside `shutdown()`,
        // which aborted the rest of the teardown and left the screen black.
        const world = scene?.matter?.world;
        if (world && this.body) {
            try {
                world.remove(this.body);
            } catch {
                // Body already removed with the world: nothing left to unregister.
            }
        }
        this.rect?.destroy();
        this.sprite?.destroy();
        this.arcGraphics?.destroy();
    }
}

// ─── Controller ──────────────────────────────────────────────────────────

export interface DropControllerCallbacks {
    /**
     * Called on weapon pickup — character owns the runtime; we tell it
     * which weapon id to switch to.
     *
     * Return value controls whether the drop is consumed:
     *   - `true`  — drop is consumed (default pickup succeeded)
     *   - `false` — drop stays on the ground (cap-replace flow is
     *               open in the hub; the drop waits for confirmation
     *               before being destroyed)
     */
    onWeaponPickup: (weaponId: string) => boolean;
}

/**
 * The drop's box for activation, straight from its Matter bounds — exact and
 * allocation-free, unlike `getBounds()` which builds a Rectangle per call.
 */
function dropBox(drop: DropInstance): Box {
    const { min, max } = drop.body.bounds;
    return {
        x: (min.x + max.x) / 2,
        y: (min.y + max.y) / 2,
        halfWidth: (max.x - min.x) / 2,
        halfHeight: (max.y - min.y) / 2,
    };
}

export class DropController {
    private readonly scene: Phaser.Scene;
    private character: CharacterRuntime;
    private readonly staticDrops: DropInstance[] = [];
    private readonly runtimeDrops: DropInstance[] = [];
    private readonly cb: DropControllerCallbacks;
    /** Optional lookup used to resolve `DropSpawn.weaponId` overrides.
     *  When a static spawn sets `weaponId`, the drop's visual is
     *  switched to that weapon's in-hand texture and the pickup
     *  callback resolves to that weapon. */
    private readonly getWeapon?: (id: string) => WeaponSpec | undefined;
    /** Resolve a drop id to its spec, so a backpack click can find the effect. */
    private readonly getDrop: (id: string) => DropSpec;

    constructor(
        scene: Phaser.Scene,
        character: CharacterRuntime,
        spawns: DropSpawn[] | undefined,
        getDrop: (id: string) => DropSpec,
        cb: DropControllerCallbacks,
        getWeapon?: (id: string) => WeaponSpec | undefined,
        /**
         * 词元盾光柱的深浅，来自关卡数据 `tokenPillarTone`
         * （主人 2026-11-12：天空之城背景偏亮，那里的光柱要变深色）。
         */
        readonly tokenPillarTone: TokenPillarTone = 'bright',
        /**
         * 当前关卡 id —— 拾取台词要按关卡判断（"礁石上有杯……"只该在海滩说）。
         * 不传就当"没有关卡信息"，只弹不限定关卡的话。
         */
        private readonly levelId?: string,
    ) {
        this.scene = scene;
        this.character = character;
        this.cb = cb;
        this.getWeapon = getWeapon;
        this.getDrop = getDrop;
        EventBus.on(INVENTORY_USE_EVENT, this.handleInventoryUse);

        // Drop restoration is unified across static (dropSpawns) and
        // runtime (monster-death) drops:
        //   - First load (no snapshot): spawn the static dropSpawns
        //     from the level config. Runtime drops can only appear
        //     later via monster deaths.
        //   - Subsequent refresh (snapshot has entries): restore
        //     every drop from the snapshot, including the static
        //     ones. The level config is NOT re-spawned — drops the
        //     player picked up last run stay picked up. Player
        //     progress through the tavern weapon wall is preserved.
        //
        // The snapshot carries `weaponId` for weapon pickups so the
        // drop's in-hand texture (which `weaponSpec.visual.texture`
        // supplies) survives a refresh.
        const dropSnapshots = useGameStore.getState().groundDropsSnapshot;
        if (dropSnapshots && dropSnapshots.length > 0) {
            for (const s of dropSnapshots) {
                try {
                    const weaponOverride = s.weaponId ? this.getWeapon?.(s.weaponId) : undefined;
                    this.runtimeDrops.push(
                        new DropInstance(
                            scene,
                            getDrop(s.specId),
                            s.x,
                            s.y,
                            false,
                            weaponOverride,
                            this.tokenPillarTone,
                        ),
                    );
                } catch {
                    // Ignore missing specs
                }
            }
        } else if (spawns) {
            // Fresh start: no snapshot yet. Spawn static drops from
            // level config so the player has something to walk into.
            const onceTaken = useGameStore.getState().oncePickupTaken;
            for (const s of spawns) {
                const weaponOverride = s.weaponId ? this.getWeapon?.(s.weaponId) : undefined;
                // 只给一次的摆位：拿过就不再摆（加冕之冠、礁石上的那杯深海特饮）。
                // 主人 2026-11-17：`现在重复进入可以无限刷（实际应该只有首次进入才有）`。
                const spec = getDrop(s.type);
                if (s.onceKey && onceTaken.includes(s.onceKey)) continue;
                this.staticDrops.push(
                    new DropInstance(
                        scene,
                        spec,
                        s.x,
                        s.y,
                        false,
                        weaponOverride,
                        this.tokenPillarTone,
                        s.onceKey,
                    ),
                );
            }
        }

        this.bindCollisions();
    }

    /**
     * Swap the character reference. Used by the tavern UI to rewire
     * magnet / pickup collision to the freshly-spawned character after
     * the player confirms a selection. The original character is
     * `character` is otherwise captured once at construction.
     */
    public setCharacter(character: CharacterRuntime): void {
        this.character = character;
    }

    /**
     * Export fine-grained snapshot of every uncollected ground drop
     * — both static (from `dropSpawns`) and runtime (monster death).
     *
     * The snapshot is the source of truth across refreshes: a player
     * who picked up a static weapon drop stays without it after
     * refresh. Static drops are seeded from `dropSpawns` only on the
     * very first load when the snapshot is empty.
     *
     * `weaponId` is captured for weapon-pickup drops so the drop's
     * in-hand texture can be restored on refresh — the snapshot is
     * the only channel that survives across reloads.
     */
    public getSnapshot(): {
        specId: string;
        x: number;
        y: number;
        weaponId?: string;
    }[] {
        const all = [...this.staticDrops, ...this.runtimeDrops];
        return all
            .filter((d) => !d.taken && d.isLanded && d.spec.id)
            .map((d) => ({
                specId: d.spec.id!,
                x: d.body.position.x,
                y: d.body.position.y,
                ...(d.weaponSpec?.id ? { weaponId: d.weaponSpec.id } : {}),
            }));
    }

    /** Spawn a drop at the given position from monster death rolls. */
    spawn(spec: DropSpec, x: number, y: number): DropInstance {
        const d = new DropInstance(this.scene, spec, x, y, true, undefined, this.tokenPillarTone);
        this.runtimeDrops.push(d);
        return d;
    }

    /**
     * Spawn a drop that is already at rest, exactly at (x, y).
     *
     * `spawn` above is the monster-death path: it starts the drop in the air
     * and pops it to a random nearby landing spot. A region trigger needs the
     * opposite — the beach juice must land on the side table and nowhere else —
     * so this skips the pop and leaves the body landed and pickable.
     */
    spawnLanded(spec: DropSpec, x: number, y: number): DropInstance {
        const d = new DropInstance(this.scene, spec, x, y, false, undefined, this.tokenPillarTone);
        this.runtimeDrops.push(d);
        return d;
    }

    /**
     * Spawn a weapon-pickup drop with a parabolic arc — used when
     * the player walks onto a new weapon at cap and the controller
     * auto-swaps the active slot. The replaced weapon launches out
     * as a runtime drop with the same drop-the-character-just-picked
     * visual style, so the player can walk back and pick it up
     * later if they change their mind.
     *
     * Marks the new drop `rejected = true` so the magnet stays off
     * until the player walks past RADIUS * 1.5 — without this, the
     * parabola lands well within the magnet radius and the player
     * immediately sucks the just-thrown weapon back up.
     */
    /**
     * A weapon pickup that starts already at rest, so a caller can fly its
     * sprite along an arc and let it settle (the cat shop's gift does this).
     */
    spawnWeaponLanded(spec: DropSpec, weaponSpec: WeaponSpec, x: number, y: number): DropInstance {
        const d = new DropInstance(this.scene, spec, x, y, false, weaponSpec, this.tokenPillarTone);
        d.rejected = true;
        this.runtimeDrops.push(d);
        return d;
    }

    spawnWeapon(spec: DropSpec, weaponSpec: WeaponSpec, x: number, y: number): DropInstance {
        const d = new DropInstance(this.scene, spec, x, y, true, weaponSpec, this.tokenPillarTone);
        d.rejected = true;
        this.runtimeDrops.push(d);
        return d;
    }

    /** Update magnet attraction towards player for landed drops */
    update(): void {
        this.autoRestore();

        const charX = this.character.body.position.x;
        const charY = this.character.body.position.y;
        const magnet = DROP_CONFIG.MAGNET;

        const allDrops = [...this.staticDrops, ...this.runtimeDrops];

        // Everything below is player-proximity work: the magnet engages inside
        // MAGNET.RADIUS and the pickup fires inside MAGNET.PICKUP_DISTANCE,
        // both far shorter than half a viewport (pinned by
        // tests/lib/drops/magnet-range.test.ts). The player is always inside
        // the camera view, so a drop outside it cannot reach either branch —
        // skipping it, and hiding it, changes nothing observable, while a 9x9
        // world's drops stop costing anything.
        const view = this.scene.cameras.main.worldView;

        for (const drop of allDrops) {
            const active = isWithinView(dropBox(drop), view);
            if (drop.sprite && drop.sprite.visible !== active) drop.sprite.setVisible(active);
            if (!active) continue;

            if (drop.taken || !drop.isLanded) continue;

            const dropX = drop.body.position.x;
            const dropY = drop.body.position.y;

            const dist = Phaser.Math.Distance.Between(charX, charY, dropX, dropY);

            // Release a previously-rejected drop once the player
            // walks far enough away (1.5× magnet radius). Without
            // this the magnet would re-engage every frame because
            // dist <= RADIUS stays true while the player stands
            // near the drop.
            if (drop.rejected && dist > magnet.RADIUS * 1.5) {
                drop.rejected = false;
            }

            // Trigger magnet attraction when within radius. Skipped
            // for rejected drops so the player isn't yanked back to
            // the drop while the hub is open (or after dismissing it).
            if (!drop.rejected && dist <= magnet.RADIUS) {
                drop.isAttracting = true;
            }

            if (drop.isAttracting) {
                // Lerp towards character position
                const newX = Phaser.Math.Linear(dropX, charX, magnet.FLY_SPEED);
                const newY = Phaser.Math.Linear(dropY, charY, magnet.FLY_SPEED);

                // Update Matter body & sprite position
                (Phaser as any).Physics.Matter.Matter.Body.setPosition(drop.body, {
                    x: newX,
                    y: newY,
                });

                if (drop.sprite) {
                    drop.sprite.setPosition(newX, newY);
                    drop.sprite.setDepth(Math.round(newY));
                }
                drop.rect.setPosition(newX, newY);

                // Check final pickup threshold
                if (dist <= magnet.PICKUP_DISTANCE) {
                    const consumed = this.applyEffect(drop);
                    if (consumed) {
                        drop.taken = true;
                        this.removeDrop(drop);
                    } else {
                        // Cap-replace flow: hub opens, drop stays put
                        // until the player walks far enough away
                        // (rejected flag) or confirms a swap
                        // (acknowledgePendingPickup). Setting
                        // isAttracting=false here is critical — without
                        // it the next frame would re-activate the
                        // magnet because dist is still <= RADIUS.
                        drop.isAttracting = false;
                        drop.rejected = true;
                    }
                }
            }
        }
    }

    destroy(): void {
        this.disposed = true;
        this.lastUseAt.clear();
        EventBus.removeListener(INVENTORY_USE_EVENT, this.handleInventoryUse);
        for (const d of this.staticDrops) d.destroy(this.scene);
        for (const d of this.runtimeDrops) d.destroy(this.scene);
        this.staticDrops.length = 0;
        this.runtimeDrops.length = 0;
    }

    /** EventBus listener identity, so destroy() can unbind exactly this one. */
    private readonly handleInventoryUse = (payload: { index: number }): void => {
        if (this.disposed) return;
        this.useFromBackpack(payload.index);
    };

    /** Set by destroy(); a torn-down controller must not answer inventory events. */
    private disposed = false;

    /**
     * When this slot was last used, in ms.
     *
     * Two listeners (a stale controller, a double-bound click) fired the same click twice
     * and each call consumed a slot. A single use is human-scale ~200ms apart, so anything
     * inside that window for the same index is the same click, not a second one.
     */
    private lastUseAt = new Map<number, number>();

    private bindCollisions(): void {
        this.scene.matter.world.on('collisionstart', (event: any) => {
            const pairs = event.pairs || [];
            for (const pair of pairs) {
                const a = pair.bodyA;
                const b = pair.bodyB;
                if (!a || !b) continue;
                const dropBody = a.label === 'drop' ? a : b.label === 'drop' ? b : null;
                if (!dropBody) continue;
                const playerBody = dropBody === a ? b : a;
                if (playerBody !== this.character.body) continue;

                const drop = this.findDrop(dropBody as MatterJS.BodyType);
                if (!drop) continue;
                if (drop.taken || !drop.isLanded) continue;
                const consumed = this.applyEffect(drop);
                if (consumed) {
                    drop.taken = true;
                    this.removeDrop(drop);
                } else {
                    // Cap-replace flow keeps the drop on the ground
                    // until the hub confirms. Stop attracting so it
                    // doesn't ride the player's center while the
                    // hub is open.
                    drop.isAttracting = false;
                }
            }
        });
    }

    private findDrop(body: MatterJS.BodyType): DropInstance | null {
        for (const d of this.staticDrops) if (d.body === body) return d;
        for (const d of this.runtimeDrops) if (d.body === body) return d;
        return null;
    }

    private removeDrop(d: DropInstance): void {
        const sIdx = this.staticDrops.indexOf(d);
        if (sIdx >= 0) this.staticDrops.splice(sIdx, 1);
        const rIdx = this.runtimeDrops.indexOf(d);
        if (rIdx >= 0) this.runtimeDrops.splice(rIdx, 1);
        d.destroy(this.scene);
    }

    /**
     * 自动补给：血/蓝掉到 30% 就自己喝碎片，补到 60% 停。
     *
     * 主人 2026-11-13：`血量掉落至<=30%时，自动使用生命碎片回复至>=60%，蓝量同理…此机制给PC端
     * 也加上吧`。规则本体（迟滞、阈值、用哪个道具）全在 `lib/drops/auto-restore.ts`，这里只负责
     * 每个间隔挑一瓶、按背包点击的同一条路喝下去。
     *
     * 一次间隔只喝一瓶：`useFromBackpack` 走的是与点击完全相同的路径，它自带的重击去重窗口
     * 也会把连发吞掉；间隔又比一瓶的落账时间长，所以第二次判定时血条已经追上了。
     */
    private lastAutoRestoreAt = 0;

    /** 迟滞状态：掉到 30% 上膛，补到 60% 才退膛。 */
    private readonly restoreArmed: Record<RestoreKind, boolean> = { hp: false, sp: false };
    /** 每种池子"没有药"的提醒是否已经说过一次（上膛后只提醒一次）。 */
    private readonly restoreMissingNotified: Record<RestoreKind, boolean> = {
        hp: false,
        sp: false,
    };

    private autoRestore(): void {
        const now = Date.now();
        if (now - this.lastAutoRestoreAt < AUTO_RESTORE_INTERVAL_MS) return;

        const vitals = this.character.vitals();
        const inventory = useGameStore.getState().inventory;

        // 先推进迟滞，再看要不要喝：一片碎片只值 25 点，只看“低于 30%”会在 40% 停下。
        this.restoreArmed.hp = nextRestoreArmed(this.restoreArmed.hp, vitals.hp, vitals.maxHp);
        this.restoreArmed.sp = nextRestoreArmed(this.restoreArmed.sp, vitals.sp, vitals.maxSp);

        for (const kind of ['hp', 'sp'] as const) {
            if (!this.restoreArmed[kind]) continue;
            const slot = restoreSlotIndex(inventory, kind);
            // 上膛了但背包里没有这一种：跳过，另一种该补还是补（不会互相阻塞）——但要说一句，
            // 否则"血掉到 30% 什么都没发生"读起来就是机制坏了。每上一次膛只提醒一次。
            if (slot < 0) {
                if (!this.restoreMissingNotified[kind]) {
                    this.restoreMissingNotified[kind] = true;
                    useGameStore.getState().showNotice(AUTO_RESTORE_MISSING_NOTICES[kind]);
                }
                continue;
            }

            this.restoreMissingNotified[kind] = false;
            this.lastAutoRestoreAt = now;
            useGameStore.getState().showNotice(AUTO_RESTORE_NOTICES[kind]);
            this.useFromBackpack(slot);
            return;
        }
    }

    /**
     * The receivers a drop effect can touch. Shared by pickup (weapons) and by a
     * backpack click, so the two paths can never drift apart.
     */
    private effectSinks(consumedRef?: { consumed: boolean }) {
        return {
            heal: (hp: number, sp: number) => this.character.heal(hp, sp),
            refillAmmo: (fraction: number) => this.character.refillAmmo(fraction),
            // `heal` clamps to [0, max], so an overkill delta is a full refill.
            fullRestore: () =>
                this.character.heal(DROP_FULL_RESTORE_AMOUNT, DROP_FULL_RESTORE_AMOUNT),
            applyTokenShield: () => {
                const pickup = grantTokenShield(useGameStore.getState().selectedCharacterId);
                // 满级之后再捡：主人要它自动变成补满血蓝。
                if (pickup.refilledHp || pickup.refilledSp) {
                    this.character.heal(DROP_FULL_RESTORE_AMOUNT, DROP_FULL_RESTORE_AMOUNT);
                }
            },
            onWeaponPickup: (id: string) => {
                if (consumedRef) consumedRef.consumed = this.cb.onWeaponPickup(id);
            },
        };
    }

    /**
     * Apply a bag item the player clicked. Returns false for items that cannot be
     * used (materials are sold, not drunk), and for unknown ids.
     */
    /**
     * Specs fetched after the level loaded.
     *
     * A level only preloads the drops it references; a potion carried in from elsewhere
     * (Atlantis had none of them) is fetched on first use and kept here.
     */
    private readonly lateDropSpecs = new Map<string, DropSpec>();

    private resolveDrop(id: string): DropSpec {
        return this.lateDropSpecs.get(id) ?? this.getDrop(id);
    }

    useFromBackpack(index: number): boolean {
        const now = Date.now();
        const last = this.lastUseAt.get(index) ?? 0;
        if (now - last < DROP_USE_DEDUPE_MS) return false;
        this.lastUseAt.set(index, now);

        const state = useGameStore.getState();
        const slot = state.inventory[index];
        if (!slot) return false;

        let spec: DropSpec;
        try {
            spec = this.resolveDrop(slot.dropId);
        } catch {
            // The level only preloads the drops it references, so a potion that lives
            // elsewhere in the game throws here - and the silent `return false` is exactly
            // what `在亚特兰蒂斯使用不了补给品，控制台也没有报错` looks like. Fetch it.
            void fetchDrop(slot.dropId)
                .then((fetched: DropSpec) => {
                    this.lateDropSpecs.set(slot.dropId, fetched);
                    this.useFromBackpack(index);
                })
                .catch((error: unknown) => {
                    console.warn(`[drops] could not load ${slot.dropId}`, error);
                    useGameStore.getState().showNotice(NOTHING_TO_DO_NOTICE);
                });
            return false;
        }
        if (spec.effect.type === 'material' || spec.effect.type === 'weapon') return false;

        // The iced juice is an easter egg before it is a heal: it always says its line, and
        // for Gemini and GPT it hands over the arcana staff. Gating it on `full-restore`
        // meant a full-health player could not drink it at all - so in every map except the
        // one where the glass is a ground drop, the staff was unreachable
        // (`哪个地图使用都可以拿到秘法权杖`).
        const egg = juiceEasterEgg(useGameStore.getState().selectedCharacterId, slot.dropId);

        // Do not eat an item that would change nothing: a shard at full HP, or an ammo box
        // with no gun to feed. The owner re-confirmed the rule after trying it the other way
        // (`之前满血满状态拒绝是对的`), so it applies to every effect again - except the drink,
        // which always has something to give.
        //
        // The click is never silent about it: the notice below is what tells a rejected use
        // apart from a dead button (`冰镇果汁根本点了没反应`).
        if (
            !egg &&
            !effectWouldDoSomething(spec.effect, this.character.vitals(), {
                hasRangedWeapon: this.character.hasRangedWeapon(),
            })
        ) {
            useGameStore.getState().showNotice(NOTHING_TO_DO_NOTICE);
            return false;
        }

        // Consume first: the effect is applied to the live character, and a
        // second click racing this one must find an empty slot.
        const consumed = state.consumeInventorySlot(index);
        if (!consumed) {
            // The store refused to give up the slot. That used to be a silent `return false`,
            // which is the same thing the player sees when the whole control is dead - say it
            // out loud instead (`冰镇果汁根本点了没反应`).
            useGameStore.getState().showNotice(NOTHING_TO_DO_NOTICE);
            return false;
        }

        // 彩蛋：Gemini 和 GPT 喝冰镇果汁 → 顺手装备秘法法杖，其他人只说一句话。
        if (egg) {
            // A full hotbar with a locked 专武 slot cannot take the staff. Do not swallow the
            // drink for it: put it back and say why, so the player can make room and retry.
            if (egg.weaponId && !this.cb.onWeaponPickup(egg.weaponId)) {
                useGameStore.getState().addInventoryItem(slot.dropId, 1);
                useGameStore.getState().showNotice('背包满了，先腾个位置再喝');
                return false;
            }
            // Close the bag, or the line plays behind a full-screen panel and nobody sees it.
            useGameStore.getState().setBackpackOpen(false);
            EventBus.emit(CHARACTER_SAY_EVENT, { text: egg.line, durationMs: 3200 });
        }

        const sfxId = spec.sfx ?? 'pickup-generic';
        EventBus.emit(SFX_EVENT(sfxId), {
            key: `drop:${slot.dropId}`,
            throttleMs: spec.throttleMs,
        });
        planDropEffect(spec, this.effectSinks());
        // The scene is paused while the bag is open, so nothing would repaint the HUD
        // until it closes. Push the new numbers now.
        this.character.refreshHud();
        return true;
    }

    private applyEffect(dropInstance: DropInstance): boolean {
        // Emit SFX BEFORE applying effect so the audio engine can play
        // before the pickup animation / freeze-frame finishes. Falls
        // back to a generic pickup tone when the spec doesn't declare
        // its own.
        const spec = dropInstance.spec;
        const playPickupSfx = () => {
            const sfxId = spec.sfx ?? 'pickup-generic';
            EventBus.emit(SFX_EVENT(sfxId), {
                key: `drop:${spec.id}`,
                throttleMs: spec.throttleMs,
            });
        };
        // For weapon drops carrying a weaponSpec override, the spec's
        // embedded `effect.weaponId` is the generic placeholder —
        // resolve to the actual weapon's id so the pickup handler
        // adds the right weapon to the hotbar. Other drop types
        // (instant / refill-ammo) go through planDropEffect normally.
        const effectiveSpec: DropSpec = dropInstance.weaponSpec
            ? ({
                  ...spec,
                  effect: { type: 'weapon', weaponId: dropInstance.weaponSpec.id },
              } as DropSpec)
            : spec;
        // Weapons still go to the hotbar directly: a hotbar slot is not a
        // backpack slot. Everything else is picked *up*, not used - the player
        // decides when to open the bag and click it.
        // 生命碎片 auto-drinks when a full shard would not be wasted: it heals on the
        // spot instead of taking a bag slot. Anything less goes in the bag to be saved.
        if (
            spec.id === HP_SHARD_ID &&
            spec.effect.type === 'instant' &&
            shouldAutoUseHpShard(
                this.character.vitals().hp,
                this.character.vitals().maxHp,
                spec.effect.hp ?? HP_SHARD_HEAL,
            )
        ) {
            playPickupSfx();
            planDropEffect(spec, this.effectSinks());
            this.character.refreshHud();
            return true;
        }

        // 词元盾：不进背包，捡到立刻生效（主人 2026-11-12）。
        if (appliesOnPickup(spec)) {
            playPickupSfx();
            planDropEffect(spec, this.effectSinks());
            this.character.refreshHud();
            return true;
        }

        if (effectiveSpec.effect.type !== 'weapon') {
            const onceKey = dropInstance.onceKey;
            const dropKey = spec.id ?? 'unknown';
            const added = useGameStore.getState().addInventoryItem(dropKey, 1);
            // A full bag leaves the item where it is, so nothing is silently lost.
            if (added > 0) {
                playPickupSfx();
                // 「带在身上就生效」的加成（加冕之冠）：捡到的这一刻就要加到上限上，
                // 否则玩家得先离开地图再进来才看得到变化（2026-11-17 实机就这么"没反应"）。
                const bonus = maxBonusOf(spec);
                if (bonus.hp > 0 || bonus.sp > 0) {
                    this.character.adjustHeldMaxBonus(bonus);
                }
                // 只给一次的摆位：记下，之后进图不再生成。
                if (onceKey) {
                    useGameStore.getState().markOncePickupTaken(onceKey);
                }
                // 道具自带的拾取提示（加冕之冠那种"这是什么东西"的说明）。
                // 放在 `added > 0` 里面：背包满、东西还在地上时不能报"已获得"。
                // 两层绑定：道具自己有台词 **且** 当前关卡在它的白名单里（没写白名单就都算）。
                const notice = pickupNoticeApplies(spec, this.levelId)
                    ? pickText(spec.pickupNotice ?? spec.pickupNoticeZh ?? '', spec.pickupNoticeZh)
                    : null;
                if (notice) useGameStore.getState().showNotice(notice);
            }
            return added > 0;
        }

        // Default consumed=true covers non-weapon drops (instant /
        // refill-ammo) which have no opt-out path. For weapons the
        // callback returns false when the cap-replace hub has not
        // confirmed yet — the caller (magnet loop / collisionstart)
        // uses this to keep the drop on the ground.
        const consumedRef = { consumed: true };
        playPickupSfx();
        planDropEffect(effectiveSpec, this.effectSinks(consumedRef));
        return consumedRef.consumed;
    }

    /**
     * Destroy the still-on-ground weapon drop the cap-replace hub is
     * negotiating. Called by the scene after `weapon-replace-confirm`
     * commits the swap, so the drop never lingers once the player has
     * actually committed to the new weapon.
     */
    acknowledgePendingPickup(weaponId: string): void {
        const all = [...this.staticDrops, ...this.runtimeDrops];
        const target = all.find(
            (d) => !d.taken && d.spec.kind === 'static' && d.weaponSpec?.id === weaponId,
        );
        if (!target) return;
        this.removeDrop(target);
    }
}
