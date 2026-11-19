/**
 * src/game/monsters/monster.ts
 * --------------------------------------------------------------------------
 * Monsters module — entity + controller + projectile + drop roller in one
 * file. Pure helpers (distBetween / dirTo / decideAIState / chaseVelocity /
 * pickClosestMonster) live in `./logic.ts`.
 *
 *   - Monster: one monster entity (body + visual + HP + AI state + weapon).
 *   - MonsterController: scene-side orchestrator. Self-spawns monsters
 *     from a spawn array, runs per-frame AI tick, fires the monster's
 *     weapon (delegated to the shared `weapons/` module).
 *   - fireProjectile: shared projectile factory (reused from weapons/).
 *   - rollDrops: monster death drop table roller (independent Bernoulli).
 *
 * Monster attacks are routed through the weapons/ module so the same
 * projectile physics, wall policy, and visual style apply. The only
 * difference is the trigger: monsters auto-fire on cooldown; the player
 * fires on click.
 */

import type { BulletRecord } from '@/game/weapons/weapon';
import { recordBossTrace } from '@/lib/dev/crash-log';
import { textureKey } from './sheet-loader';
import { arenaSpotIndexForPhase } from '@/lib/bosses/arena';
import { isBossMeleeRange, WRATH_PAIR_DELAY_MS, wrathDue } from '@/lib/bosses/attacks';
import {
    BOSS_NAME_FONT_PX,
    bossPhaseNameColour,
    bossPhaseTitle,
    phaseEndHp,
    bossPhaseIsFinal,
    bossStartPhaseIndex,
} from '@/lib/bosses/phases';

/** How far a boss engages from, whatever her AI state says. */
const BOSS_ENGAGE_RANGE_PX = 900;
import { safeRemoveBody } from '@/lib/physics/safe-remove';
import * as Phaser from 'phaser';

import {
    CAT,
    PROJECTILE_MONSTER_MASK,
    COMBAT_PLAYER_DAMAGE_COOLDOWN_MS,
    COMBAT_CRIT_MULTIPLIER,
    COMBAT_CRIT_DAMAGE_MULTIPLIER,
    COMBAT_HIT_FLASH_MS,
    COMBAT_HIT_STUN_MS,
    COMBAT_SCREEN_SHAKE_CRIT,
    COMBAT_SCREEN_SHAKE_EXPLOSION,
    DEPTH,
    MONSTER_DEATH_FADE_MS,
    SFX_EVENT,
    BOSS_PHASE_TRANSITION_MS,
} from '@/lib/constants';
import { damageAfterArmor } from '@/lib/characters/combat';
import { getCheats } from '@/lib/dev/cheats';
import { EventBus } from '@/lib/events/bus';
import type { WeaponSpec } from '@/lib/weapons';
import { spawnProjectile, spawnMeleeHitbox } from '@/game/weapons/weapon';
import { spawnHitSparks } from '@/game/weapons/hit-sparks';
import { WeaponVisualController } from '@/game/weapons/visual';
import {
    advanceSpawnQueue,
    type AliveSnapshot,
    type PendingSpawn,
} from '@/game/monsters/spawn-queue';
import type { MonsterTrigger } from '@/lib/levels';
import type { MonsterSpec } from '@/lib/monsters';
import { monsterDisplayName } from '@/lib/monsters/display-name';
import { isAbandoned, isOutsideWorld } from '@/lib/monsters/lost';
import { BOSS_PHASE_CLEAR_EVENT } from '@/lib/bosses/phase-reward';
import { StatusHud } from '@/game/hubs/status-hud';
import { useGameStore, type MonsterSystemSnapshot } from '@/store/game-store';

import {
    chaseVelocity,
    decideAIState,
    dirTo,
    distBetween,
    isWaypointReached,
    pickClosestMonster,
    PathfindingService,
    calcSeparationForce,
    getSurroundOffset,
    calcKnockbackVelocity,
    isRoarBoss,
    roarDamageFor,
    monsterAnimTrack,
} from './logic';
import {
    MONSTERS_REMAINING_EVENT,
    remainingCount,
    remainingWithPending,
} from '@/lib/monsters/remaining';
import {
    BOSS_PHASES,
    clampBossDamage,
    phaseAt,
    BOSS_FALL_MS,
    bossFallAlpha,
    bossFallPlan,
    bossFallTilt,
    nextPhase,
    pickNextAttack,
    type BossAttackId,
    scaleForPhase,
    type BossPhase,
    spriteHeightForPhase,
} from '@/lib/bosses/phases';
import {
    BOSS_ATTACKS,
    BOSS_MELEE_REACH,
    WRATH_CIRCLES,
    WRATH_CIRCLES_LOW_HP,
} from '@/lib/bosses/attacks';
import { castWrath, fireBarrage, fireCannon, type BossAttackContext } from './boss-attacks';

/**
 * 半神（第 3 阶段）的伤害倍率。守关 boss 的三招都按它算伤害，这样主人日后调阶段数值时
 * 三只守关 boss 会一起跟着走，不需要再改一遍怪物 YAML。
 */
const DEMIGOD_DAMAGE_SCALE = 0.8;
// ─── Entity ──────────────────────────────────────────────────────────────

export type MonsterState = 'idle' | 'chase' | 'attack' | 'dying';

export { loadMonsterAssets, textureKey } from './sheet-loader';

export function animKey(spec: MonsterSpec, animName: string): string {
    return `${textureKey(spec)}:${animName}`;
}

export function createMonsterAnims(
    scene: Pick<Phaser.Scene, 'anims'>,
    specs: Iterable<MonsterSpec>,
): void {
    for (const spec of specs) {
        if (!spec.anims) continue;
        for (const [name, anim] of Object.entries(spec.anims)) {
            const key = animKey(spec, name);
            if (scene.anims.exists(key)) scene.anims.remove(key);
            const texture = textureKey(spec);
            const frames: Phaser.Types.Animations.AnimationFrame[] = [];
            for (let i = anim.frames[0]; i <= anim.frames[1]; i++) {
                frames.push({ key: texture, frame: i });
            }
            scene.anims.create({
                key,
                frames,
                frameRate: anim.frameRate,
                repeat: anim.repeat,
            });
        }
    }
}

export class Monster {
    readonly spec: MonsterSpec;
    readonly weapon: WeaponSpec;
    readonly body: MatterJS.BodyType;
    readonly rect: Phaser.GameObjects.Rectangle;
    readonly debugBodyRect: Phaser.GameObjects.Rectangle;
    readonly debugHitboxRect: Phaser.GameObjects.Rectangle;
    readonly sprite?: Phaser.GameObjects.Sprite;
    readonly shadow: Phaser.GameObjects.Ellipse;
    readonly hitboxWidth: number;
    readonly hitboxHeight: number;
    /** Floating HP bar / name label above the monster. Built once and kept alive
     * through the `dying` state (visibility toggled instead of destroyed) so the
     * death animation can show 0 HP without re-spawning the HUD mid-tween. */
    readonly statusHud: StatusHud;
    /** Floating weapon attachment (sprite + aim rotation + recoil/swing tweens).
     * Mirrors `WeaponController.visualController` on the player so monsters
     * visually hold their weapon the same way. Always created; `setWeapon`
     * leaves the sprite null when the weapon has no `visual.texture`, but
     * the controller is still callable for animation triggers (swing). */
    readonly weaponVisual: WeaponVisualController;
    hp: number;
    /**
     * Which rung of the boss ladder this monster is on (0 = phase 1).
     *
     * Always 0 for ordinary monsters; their health bar is `spec.hp` either way, so
     * the only observable difference is that a boss's `phaseMaxHp` moves while a
     * drone's does not.
     */
    phaseIndex = 0;
    /** The health pool of the CURRENT phase. Equals `hp` when the phase begins. */
    phaseMaxHp: number;
    /** Frozen and unattackable until this timestamp (phase transition beat). */
    invulnerableUntil = 0;
    /** Boss only: the attack she used last, so she never repeats it twice in a row. */
    lastBossAttack: BossAttackId | null = null;
    /** Boss only: wrath waves fired this phase - what entropy counts. */
    wrathWaves = 0;
    /** Boss only: primary attacks started this phase - what throttles 天谴轰炸. */
    bossRounds = 0;
    state: MonsterState = 'idle';
    lastAttackAt = 0;
    lastHitAt = 0;
    hitFlashUntil = 0;
    hitStunUntil = 0;
    /** Set by MonsterController when killed — used to suppress further collisions. */
    dead = false;
    hitboxBody?: MatterJS.BodyType;
    /** One-shot guard so the aggro growl only fires once per monster. */
    hasAggroed = false;
    /** While `time < turnUntil` the monster is playing its `turn` track. */
    turnUntil = 0;
    /** While `time < fallUntil` she is lying down between boss phases (see `BOSS_FALL_MS`). */
    fallUntil = 0;
    /** True when the sheet has no fall clip, so the alpha curve carries the beat instead. */
    fallFade = false;
    /** Previous frame's chase flag, so the turn triggers on the transition only. */
    wasChasing = false;
    /** Waypoints for pathfinding navigation. */
    path: { x: number; y: number }[] | null = null;
    currentWaypointIdx = 0;
    lastPathRecalcAt = 0;
    lastRecalcTargetPos = { x: 0, y: 0 };
    /** Stuck detection and emergency pathing recovery fields. */
    stuckCheckPos = { x: 0, y: 0 };
    stuckTicks = 0;
    lastStuckCheckAt = 0;
    noLoSUntil = 0;
    /** When > now (ms), the collision handler is driving this monster's
     *  velocity directly (Matter collisionstart fired). The per-frame
     *  velocity loop skips its LERP / targetDir work for the duration
     *  so the escape direction isn't immediately overwritten. */
    wallEscapeUntil = 0;
    /** Wave identifier from the level spawn entry — used by `clear`
     *  triggers that wait on a specific wave. Undefined for spawns that
     *  aren't part of a named wave. */
    waveId?: string;
    /** Visual tint per weapon kind — derived from weapon (ranged/melee). */
    static readonly TINT_MELEE = 0xef4444;
    static readonly TINT_RANGED = 0xa855f7;

    constructor(
        scene: Phaser.Scene,
        spec: MonsterSpec,
        weapon: WeaponSpec,
        x: number,
        y: number,
        waveId?: string,
    ) {
        this.spec = spec;
        this.weapon = weapon;
        this.hp = spec.hp;
        this.phaseMaxHp = spec.hp;
        this.stuckCheckPos = { x, y };
        this.waveId = waveId;

        // Hitbox (Red Box): full sprite frame size for bullet & attack collisions
        let hw = spec.body.halfW * 2;
        let hh = spec.body.halfH * 2;

        if (spec.sprite && scene.textures.exists(textureKey(spec))) {
            const frame = scene.textures.getFrame(textureKey(spec), 0);
            const scale = spec.sprite.scale ?? 1.0;
            if (frame) {
                hw = frame.width * scale * 0.8;
                hh = frame.height * scale;
            }
        }

        this.hitboxWidth = hw;
        this.hitboxHeight = hh;

        // Bodybox (Green Box): in the footer
        const bw = spec.body.halfW * 2;
        const bh = spec.body.halfH * 2;
        const centerY = y;

        this.body = scene.matter.add.rectangle(x, centerY, bw, bh, {
            label: 'monster',
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0.02,
            restitution: 0,
            chamfer: { radius: Math.min(8, Math.min(bw, bh) / 4) },
            collisionFilter: {
                category: CAT.MONSTER_MELEE,
                mask: CAT.CHARACTER | CAT.BULLET | (CAT.WALL_TALL | CAT.WALL_SHORT),
            },
        });

        // Hitbox Sensor (Red Box): full sprite dimensions for bullet hits & attacks
        // A prop's art *is* what the player aims at, so its hitbox sits centred
        // on the body instead of one frame-height above it.
        const hitCenterY = spec.prop ? y : y - hh / 2;
        this.hitboxBody = scene.matter.add.rectangle(x, hitCenterY, hw, hh, {
            label: 'monster-hitbox',
            isSensor: true,
            collisionFilter: {
                category: CAT.MONSTER_MELEE,
                mask: CAT.BULLET,
            },
        });
        (this.body as any).monsterRef = this;
        (this.hitboxBody as any).monsterRef = this;

        const matter = (Phaser as any).Physics.Matter.Matter;
        // A prop is shootable scenery, not a creature: a static body ignores
        // both the AI's setVelocity and knockback impulses, so nothing can
        // push it out of place.
        if (spec.prop) {
            matter.Body.setStatic(this.body, true);
        }

        // Foot shadow based on hit box size
        this.shadow = scene.add.ellipse(
            x,
            y,
            spec.body.halfW * 2,
            spec.body.halfH * 0.8,
            0x000000,
            0.3,
        );

        // A prop has no foot shadow (it would land on top of the black hole).
        if (spec.prop) {
            this.shadow.setVisible(false);
        }

        // Status HUD above monster hitbox
        this.statusHud = new StatusHud(scene, this.body);

        // A prop shows no name, no HP bar and no floating damage numbers —
        // hiding the whole HUD container covers all three at once.
        if (spec.prop) {
            this.statusHud.setVisible(false);
        }

        // Weapon visual attachment — mirrors how the player carries weapons.
        // Always created so melee (swing) and ranged (recoil) share the same
        // animation path. `setWeapon` skips the sprite if `visual.texture`
        // is missing, leaving only the controller (invisible but callable).
        this.weaponVisual = new WeaponVisualController(scene);
        this.weaponVisual.setWeapon(weapon);

        // Feet Body Debug Rect (Green outline)
        this.debugBodyRect = scene.add.rectangle(x, y, spec.body.halfW * 2, spec.body.halfH * 2);
        this.debugBodyRect.setStrokeStyle(2, 0x22c55e, 1);
        this.debugBodyRect.setDepth(9999);
        this.debugBodyRect.setVisible(false);

        // Full Hitbox Debug Rect (Red outline for all Hitboxes)
        const hitboxTint = 0xef4444;
        this.debugHitboxRect = scene.add.rectangle(x, centerY, hw, hh, hitboxTint, 0.25);
        this.debugHitboxRect.setStrokeStyle(2, hitboxTint, 1);
        this.debugHitboxRect.setDepth(10000);
        this.debugHitboxRect.setVisible(false);

        this.rect = this.debugHitboxRect;

        if (spec.sprite && scene.textures.exists(textureKey(spec))) {
            const spriteObj = scene.add.sprite(x, y, textureKey(spec));
            if (spec.sprite.scale) {
                spriteObj.setScale(spec.sprite.scale);
            }
            // A boss is sized by her phase, not by the authored scale: the first three
            // forms stand 198px, phase four shrinks to 186, the last to the player's 173.
            if (spec.boss && spriteObj.frame?.height) {
                spriteObj.setScale(phaseSpriteScale(spriteObj.frame.height, 0));
            }

            const idleKey = animKey(spec, 'idle');
            if (scene.anims.exists(idleKey)) {
                spriteObj.play(idleKey);
            }
            this.sprite = spriteObj;
        }
    }

    position(): { x: number; y: number } {
        return this.body.position;
    }

    /** Calculate clearance radius using full physical Hitbox dimensions x 2. */
    getHitboxRadius(): number {
        return Math.hypot(this.hitboxWidth, this.hitboxHeight) * 2;
    }

    destroy(scene: Phaser.Scene): void {
        // The Matter world can already be gone when this runs during scene shutdown;
        // throwing here used to abort the shutdown and leave a black screen.
        const world = scene?.matter?.world ?? null;
        safeRemoveBody(world, this.body);
        if (this.hitboxBody) {
            safeRemoveBody(world, this.hitboxBody);
        }
        this.debugBodyRect?.destroy();
        this.debugHitboxRect?.destroy();
        this.sprite?.destroy();
        this.shadow?.destroy();
        this.statusHud?.destroy();
        this.weaponVisual?.destroy?.();
        this.dead = true;
    }
}

/**
 * Sprite scale that draws a boss at the height her phase asks for.
 *
 * The sheet's cell size differs from the characters' (256 vs 192), so a plain `scale` in
 * the YAML cannot express "198px tall" across sheets - it has to be computed.
 */
function phaseSpriteScale(cellHeight: number, phaseIndex: number): number {
    return spriteHeightForPhase(phaseAt(phaseIndex)) / cellHeight;
}

// ─── Drop roller ─────────────────────────────────────────────────────────

export interface RolledDrop {
    dropId: string;
    spec: unknown; // DropSpec — resolved at the call site
}

// `rollDrops` lives in `./logic` so it can be tested without pulling a Phaser canvas
// into the module graph; re-exported here for the callers that already import it.
export { rollDrops } from './logic';

// ─── Controller ──────────────────────────────────────────────────────────

export interface MonsterControllerCallbacks {
    /** Called when a monster dies (HP ≤ 0). Useful for drop rolling. */
    onMonsterDied: (monster: Monster) => void;
    /**
     * Called when the player takes damage from a monster's projectile.
     * The HP application lives in the character module; here we just notify.
     */
    onPlayerHit: (damage: number) => void;
}

/** Snapshot of a monster projectile — owns body + visual + damage. */
export interface MonsterProjectile {
    body: MatterJS.BodyType;
    rect:
        | Phaser.GameObjects.Shape
        | Phaser.GameObjects.Sprite
        | Phaser.GameObjects.Image
        | Phaser.GameObjects.Graphics;
    damage: number;
    monster: Monster;
    /** Spawn point of the projectile (world coords). The per-frame
     *  cleanup compares the bullet's current position against this to
     *  retire ones that fly past their effective range instead of
     *  lingering forever in the world. */
    originX: number;
    originY: number;
    /** Effective range inherited from the firing weapon spec. The
     *  bullet self-destructs once it's travelled this far from the
     *  spawn point, mirroring how WeaponController cleans up
     *  player bullets (logic.ts "speed < 1.0 || distSq >= maxDistance²"). */
    maxDistance: number;
    /** Foot-Y of the firing monster at spawn time. The per-frame sync
     *  loop tracks the firing monster's *current* footY so the bullet
     *  stays in its owner's depth slot as the monster moves; this
     *  pinned value is the fallback once the monster dies or starts
     *  dying mid-flight (no owner to track). */
    fireFootY: number;
    /** Mirror of BulletRecord.spawnAt / lifeMs — populated by the
     *  ranged-path spawn call so the per-frame cleanup can expire
     *  missed shots instead of waiting for Matter friction to drop
     *  speed below the 1.0 px/frame threshold. */
    spawnAt: number;
    lifeMs: number;
}

export class MonsterController {
    private readonly scene: Phaser.Scene;
    private readonly monsters: Monster[] = [];
    /** Unsubscribes the dragon-roar listener. */
    private roarCleanup?: () => void;
    /** Set by `destroy()`. Bus subscribers outlive the scene, so they check it. */
    private destroyed = false;
    /** Last 剩余怪物数 published to the HUD, so unchanged frames cost nothing. */
    private lastRemaining = -1;
    private readonly projectiles: MonsterProjectile[] = [];
    private readonly cb: MonsterControllerCallbacks;
    /** Cached for fast lookup in attack tests. */
    private playerBody: MatterJS.BodyType;
    private readonly matter: any;
    private readonly pathfinder?: PathfindingService;
    /** 这一关只打 Claude 的哪一阶段（1 起，见 `level.bossPhase`）。 */
    private readonly bossPhase: number;
    private lastPathCalcAt = 0;
    private lastPlayerPos = { x: 0, y: 0 };
    /** Last attack timestamp per monster — independently tracked to avoid
     *  interleaved races when two monsters fire on the same frame. */
    private lastDamageAt = 0;
    /** Player's luck stat (1–10). Drives crit chance = luck/10.
     *  Injected via setPlayerLuck() after the character spec is loaded. */
    private playerLuck = 1;
    private currentCombo = 0;
    private lastComboHitAt = 0;

    /** Trigger-gated monster spawns awaiting their fire condition. Pairs the
     *  pure `PendingSpawn` (consumed by `advanceSpawnQueue`) with the heavy
     *  spec/weapon handles needed to instantiate the monster at fire time. */
    private pendingSpawns: { pending: PendingSpawn; spec: MonsterSpec; weapon: WeaponSpec }[] = [];

    constructor(
        scene: Phaser.Scene,
        spawns:
            | {
                  spec: MonsterSpec;
                  weapon: WeaponSpec;
                  x: number;
                  y: number;
                  trigger?: MonsterTrigger;
                  waveId?: string;
              }[]
            | undefined,
        playerBody: MatterJS.BodyType,
        cb: MonsterControllerCallbacks,
        pathfinder?: PathfindingService,
        /** `level.bossPhase`：四块地图各打一阶段。 */
        bossPhase = 1,
    ) {
        this.scene = scene;
        this.playerBody = playerBody;
        this.cb = cb;
        this.bossPhase = bossPhase;
        this.matter = (Phaser as any).Physics.Matter.Matter;
        this.pathfinder = pathfinder;

        // GPT's dragon roar: the effect belongs to the monsters, which own
        // their own HP, so the character pays for the roar and announces it,
        // and this module decides who was on screen to feel it.
        const roarHandler = (payload?: { hpFraction?: number }) => {
            this.applyRoarDamage(payload?.hpFraction ?? 0.5);
        };
        EventBus.on('skill:dragon-roar', roarHandler);
        this.roarCleanup = () => EventBus.removeListener('skill:dragon-roar', roarHandler);
        const monsterSnapshot = useGameStore.getState().activeMonstersSnapshot;
        const activeMonsters = Array.isArray(monsterSnapshot?.activeMonsters)
            ? monsterSnapshot!.activeMonsters
            : Array.isArray(monsterSnapshot)
              ? (monsterSnapshot as any)
              : undefined;

        if (activeMonsters) {
            // Restore active monster entities from snapshot
            for (const snap of activeMonsters) {
                const match = spawns?.find((s) => s.spec.id === snap.specId);
                if (match) {
                    const monster = new Monster(
                        scene,
                        match.spec,
                        match.weapon,
                        snap.x,
                        snap.y,
                        snap.waveId,
                    );
                    monster.hp = snap.hp;
                    if (monster.spec.boss && typeof snap.phaseIndex === 'number') {
                        monster.phaseIndex = snap.phaseIndex;
                        if (monster.sprite?.frame?.height) {
                            monster.sprite.setScale(
                                phaseSpriteScale(monster.sprite.frame.height, snap.phaseIndex),
                            );
                        }
                        monster.phaseMaxHp = scaleForPhase(
                            { hp: monster.spec.hp, moveSpeed: monster.spec.moveSpeed, damage: 1 },
                            phaseAt(snap.phaseIndex),
                        ).hp;
                    }
                    this.monsters.push(monster);
                }
            }
            // Restore pending spawns queue using saved pendingSpawnIndices
            if (spawns && Array.isArray(monsterSnapshot?.pendingSpawnIndices)) {
                const pendingSet = new Set(monsterSnapshot!.pendingSpawnIndices);
                spawns.forEach((s, index) => {
                    if (pendingSet.has(index) && s.trigger) {
                        this.pendingSpawns.push({
                            pending: {
                                index,
                                type: s.spec.id!,
                                x: s.x,
                                y: s.y,
                                trigger: s.trigger,
                                waveId: s.waveId,
                            },
                            spec: s.spec,
                            weapon: s.weapon,
                        });
                    }
                });
            }
        } else if (spawns) {
            spawns.forEach((s, index) => {
                const trigger = s.trigger;
                // Immediate: no trigger at all, OR `kind: 'time', delayMs: 0`.
                // Branch in two separate checks so TS narrows `trigger` to a
                // non-undefined type after the if/return.
                if (!trigger || (trigger.kind === 'time' && trigger.delayMs === 0)) {
                    const spawned = new Monster(scene, s.spec, s.weapon, s.x, s.y, s.waveId);
                    this.applyBossStartPhase(spawned);
                    this.monsters.push(spawned);
                    return;
                }
                this.pendingSpawns.push({
                    pending: {
                        index,
                        type: s.spec.id!,
                        x: s.x,
                        y: s.y,
                        trigger,
                        waveId: s.waveId,
                    },
                    spec: s.spec,
                    weapon: s.weapon,
                });
            });
        }

        this.bindCollisions();
    }

    /**
     * Swap the player body reference. Used by the tavern UI to rewire
     * monsters / collisions to a freshly-spawned character after the
     * player picks a new one — the `playerBody` field is otherwise
     * captured once at construction.
     */
    public setPlayerBody(body: MatterJS.BodyType): void {
        this.playerBody = body;
    }

    /** Export fine-grained snapshot of active monsters and remaining pending spawn queue. */
    public getSnapshot(): MonsterSystemSnapshot {
        const activeMonsters = this.monsters
            .filter((m) => !m.dead && m.state !== 'dying')
            .map((m) => ({
                specId: m.spec.id!,
                hp: m.hp,
                x: m.body.position.x,
                y: m.body.position.y,
                waveId: m.waveId,
                // Only bosses carry a phase; leaving it off keeps ordinary
                // monsters' snapshots byte-identical to before.
                ...(m.spec.boss ? { phaseIndex: m.phaseIndex } : {}),
            }));
        const pendingSpawnIndices = this.pendingSpawns.map((p) => p.pending.index);
        return {
            activeMonsters,
            pendingSpawnIndices,
        };
    }

    /** Get active alive monsters positions (hitbox center) for aim assist magnet. */
    public getActiveMonsters(): { id: number; x: number; y: number }[] {
        return this.monsters
            .filter((m) => !m.dead && m.state !== 'dying')
            .map((m, idx) => ({ id: idx, x: m.body.position.x, y: m.body.position.y }));
    }

    /** Editor-only: expose raw Monster handles so the path debug
     *  overlay can read `m.path` / `m.currentWaypointIdx`. Production
     *  code uses the lightweight getActiveMonsters() above. */
    public getDebugMonsters(): readonly Monster[] {
        return this.monsters.filter((m) => !m.dead && m.state !== 'dying');
    }

    /** Check if all monsters in this level are dead and no pending spawns remain. */
    /**
     * Spawn a monster that is not in the level YAML - the follow-spawn waves.
     * Same entity as the hand-placed ones, so every AI / drop / HUD path applies.
     */
    public spawnDynamic(
        spec: MonsterSpec,
        weapon: WeaponSpec,
        x: number,
        y: number,
        waveId?: string,
    ): Monster {
        const monster = new Monster(this.scene, spec, weapon, x, y, waveId);
        this.applyBossStartPhase(monster);
        this.monsters.push(monster);
        return monster;
    }

    public isAllCleared(): boolean {
        const aliveCount = this.monsters.filter((m) => !m.dead && m.state !== 'dying').length;
        return aliveCount === 0 && this.pendingSpawns.length === 0;
    }

    /** Per-monster "how long has it been far away" clock, for the lost sweep below. */
    private outOfRangeSince = new Map<Monster, number>();

    /**
     * Write off monsters the player can no longer fight.
     *
     * The level only clears when every living monster is gone, so one spawned onto the lip of
     * a floating platform - or wedged inside a wall - closes the exit forever. The owner hit
     * exactly that in the sky city (`3波打完了，但是没出传送阵，找了全图没有怪了`).
     *
     * Two cases are provably unfightable: outside the painted world, or far away and untouched
     * for ABANDON_AFTER_MS while the player keeps fighting elsewhere. Both are removed WITHOUT
     * loot - the player never saw them, so paying bounty would be free money.
     */
    public sweepLost(
        player: { x: number; y: number },
        world: { width: number; height: number },
        now: number,
    ): number {
        let removed = 0;
        for (const m of this.monsters) {
            if (m.dead || m.state === 'dying') {
                this.outOfRangeSince.delete(m);
                continue;
            }
            const pos = m.body.position;
            const dist = Math.hypot(pos.x - player.x, pos.y - player.y);

            if (isOutsideWorld(pos, world)) {
                this.removeLost(m);
                this.outOfRangeSince.delete(m);
                removed += 1;
                continue;
            }

            if (!isAbandoned(dist, 0)) {
                this.outOfRangeSince.delete(m);
                continue;
            }
            const since = this.outOfRangeSince.get(m) ?? now;
            this.outOfRangeSince.set(m, since);
            if (isAbandoned(dist, now - since)) {
                this.removeLost(m);
                this.outOfRangeSince.delete(m);
                removed += 1;
            }
        }
        return removed;
    }

    /** Remove a monster without death animation, loot or bounty. */
    private removeLost(m: Monster): void {
        m.dead = true;
        m.state = 'dying';
        m.body.collisionFilter.mask = 0;
        m.sprite?.destroy();
        m.weaponVisual?.setVisible(false);
        this.updateWaveProgressSave();
    }

    /**
     * Compute the monster's current foot-Y. Foot position is what the
     * A* waypoints correspond to (rectangle bottom edge), not the body
     * centre. Used as the Y-sort anchor for the sprite / shadow /
     * weapon / bullet / melee stack — keeping the math in one place
     * ensures every visual derives depth from the same value.
     */
    public static computeFootY(m: Monster): number {
        const mp = m.body.position;
        const monsterBodyHalfH = m.spec.body.halfH;
        return Math.round(mp.y + (m.sprite ? m.sprite.displayHeight / 2 - monsterBodyHalfH : 0));
    }

    /** Camera-sized world rect the pathfinder treats as "on camera". Outside it
     *  monsters walk straight at the player instead of running A* — see
     *  PathfindingService.setFocus. */
    setPathFocus(view: { left: number; top: number; right: number; bottom: number }): void {
        this.pathfinder?.setFocus(view);
    }

    /** Per-frame: AI tick + projectile sync + cleanup. */
    update(time: number): void {
        this.advancePendingSpawns(time);
        const pp = this.playerBody.position;
        const playerMovedDist = distBetween(this.lastPlayerPos, pp);
        const shouldRecalcPaths =
            this.pathfinder && (playerMovedDist > 16 || time - this.lastPathCalcAt > 150);

        if (shouldRecalcPaths) {
            this.lastPathCalcAt = time;
            this.lastPlayerPos = { x: pp.x, y: pp.y };
        }

        const totalMonsters = this.monsters.length;

        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const m = this.monsters[i];
            if (m.dead) {
                this.monsters.splice(i, 1);
                continue;
            }
            const mp = m.body.position;
            const dist = distBetween(mp, pp);
            const dirToPlayer = dirTo(mp, pp);

            // Compute surround target offset around player to prevent crowding single-file
            const surroundOffset = getSurroundOffset(
                i,
                totalMonsters,
                Math.min(28, m.weapon.range * 0.45),
            );
            const targetPos = { x: pp.x + surroundOffset.x, y: pp.y + surroundOffset.y };

            // Dynamic clearance radius based on exact physical Hitbox dimensions
            const monsterBodyRadius = m.getHitboxRadius();
            // Foot position — the A* waypoints correspond to where the
            // monster's FEET stand, not where its body centre sits.
            // The body rectangle extends halfH below mp (the spec
            // positions the rectangle with its top edge at the sprite
            // head and its bottom edge at the feet). Driving the path
            // from the foot position means a waypoint "passes" the
            // wall if the feet fit there — the body clears the wall
            // automatically. Otherwise the path grazes the wall top
            // and the body bottom collides.
            const monsterBodyHalfH = m.spec.body.halfH;
            const footX = mp.x;
            const footY = MonsterController.computeFootY(m);
            const footPos = { x: footX, y: footY - monsterBodyHalfH / 2 };

            // Per-monster Active Stuck Detector — 60ms window so escape fires
            // before the player sees a single bounce. Measures
            // PROGRESS TOWARD THE TARGET rather than raw movedDist:
            // when Matter bounces the body off a wall, raw movedDist
            // stays large (the body reflected, often perpendicular to
            // the wall) so the original < 1.5 px heuristic never
            // trips. A monster bouncing against a wall is making zero
            // progress toward its target, which is exactly what we
            // need to detect.
            let isStuckEmergency = false;
            if (time - m.lastStuckCheckAt >= 60) {
                m.lastStuckCheckAt = time;
                // Progress = how much the monster closed the gap to
                // targetPos in this window. Negative = moving away.
                const fromOld = {
                    x: m.stuckCheckPos.x - targetPos.x,
                    y: m.stuckCheckPos.y - targetPos.y,
                };
                const fromNow = { x: mp.x - targetPos.x, y: mp.y - targetPos.y };
                const oldDist = Math.hypot(fromOld.x, fromOld.y);
                const nowDist = Math.hypot(fromNow.x, fromNow.y);
                const progress = oldDist - nowDist; // > 0 = closing in
                // Threshold: less than 1 px of closing over 60ms
                // (~16.6 px/s) while in chase = stuck. Generous so
                // curving pursuit doesn't false-positive.
                if (m.state === 'chase' && progress < 1.0) {
                    m.stuckTicks++;
                    if (m.stuckTicks >= 1) {
                        isStuckEmergency = true;
                        m.noLoSUntil = time + 2000; // Disable direct LoS shortcut for 2s
                        if (this.pathfinder) {
                            const newPath = this.pathfinder.findPath(
                                footPos,
                                targetPos,
                                m.spec.body.halfW,
                                monsterBodyHalfH,
                            );
                            if (newPath && newPath.length > 1) {
                                m.path = newPath;
                                m.currentWaypointIdx = this.pathfinder.skipBufferZoneWaypoints(
                                    newPath,
                                    1,
                                );
                            }
                        }
                    }
                } else {
                    m.stuckTicks = 0;
                }
                m.stuckCheckPos = { x: mp.x, y: mp.y };
            }

            if (m.state === 'dying') {
                // Freeze physics body during death animation
                this.matter.Body.setVelocity(m.body, { x: 0, y: 0 });
                if (m.statusHud) {
                    const halfH = m.sprite ? m.sprite.displayHeight / 2 : m.spec.body.halfH;
                    m.statusHud.update(
                        { hp: 0, maxHp: m.phaseMaxHp, showHpBar: false },
                        time,
                        halfH,
                    );
                }
                continue;
            }

            // ── AI transitions ─────────────────────────────────────────
            const prevState = m.state;
            // Pass prev state so decideAIState can apply hysteresis —
            // without it, distance jitter around `attackRange` flips
            // chase ↔ attack every frame and the idle/move animation
            // strobes with it.
            const prevAiState: 'chase' | 'attack' = prevState === 'attack' ? 'attack' : 'chase';
            // A prop stays idle: no chase, no attack, no aggro growl, and the
            // stuck detector (which pathfinds every 60ms) never fires.
            m.state = m.spec.prop ? 'idle' : decideAIState(dist, m.weapon.range, prevAiState);
            // One-shot aggro growl on the first idle → chase transition.
            if (!m.hasAggroed && prevState === 'idle' && m.state === 'chase') {
                m.hasAggroed = true;
                EventBus.emit(SFX_EVENT(m.spec.sfx?.aggro ?? 'monster-aggro'));
            }

            // ── Velocity ──────────────────────────────────────────────
            let desiredVx = 0;
            let desiredVy = 0;
            if (m.state === 'chase') {
                // Per-frame A* path recalc — every chase frame, not
                // every 150 ms. The previous "recalc only when player
                // moved > 16 px OR 150 ms passed" left the monster
                // with a stale (or null) path for most of its life,
                // which is exactly why it kept ramming walls. A* on a
                // 16-px grid is microseconds per monster — the per-
                // frame cost is fine for a handful of monsters.
                // `shouldRecalcPaths` was a perf shortcut that turned
                // out to be a correctness bug.
                if (this.pathfinder) {
                    const distTargetMoved = Math.hypot(
                        targetPos.x - m.lastRecalcTargetPos.x,
                        targetPos.y - m.lastRecalcTargetPos.y,
                    );
                    // Hysteresis Guard: do not replace active path mid-way unless target moved > 48px or stuck
                    const hasFinishedPath = !m.path || m.currentWaypointIdx >= m.path.length;
                    const shouldRecalc =
                        hasFinishedPath || distTargetMoved > 48 || isStuckEmergency;

                    if (shouldRecalc) {
                        m.lastPathRecalcAt = time;
                        m.lastRecalcTargetPos = { x: targetPos.x, y: targetPos.y };
                        const canUseLoS = time >= m.noLoSUntil;
                        if (
                            canUseLoS &&
                            this.pathfinder.hasLineOfSight(footPos, targetPos, monsterBodyRadius)
                        ) {
                            m.path = [footPos, targetPos];
                            m.currentWaypointIdx = 1;
                        } else {
                            const path = this.pathfinder.findPath(
                                footPos,
                                targetPos,
                                m.spec.body.halfW,
                                monsterBodyHalfH,
                            );
                            if (path && path.length > 1) {
                                m.path = path;
                                m.currentWaypointIdx = 1;
                            }
                        }
                    }
                }

                // Resolve targetDir in priority order:
                //   1. Direct line-of-sight to targetPos → straight line
                //      (cheapest, smoothest, no need for waypoints).
                //   2. Otherwise → next waypoint along the A* path. The
                //      path is the source of truth for "how do I get
                //      around the wall", not a fallback when LoS fails.
                // The previous version used dirTo(mp, targetPos) as the
                // DEFAULT, then only overrode with the path when LoS was
                // blocked AND a path existed AND the monster hadn't run
                // off the end. That meant in any other case — no path,
                // path complete, LoS clear — the monster reverted to
                // straight-line chase and rammed the wall.
                let targetDir: { x: number; y: number };
                const canUseLoS = time >= m.noLoSUntil;
                const hasLoS =
                    canUseLoS &&
                    (this.pathfinder?.hasLineOfSight(footPos, targetPos, monsterBodyRadius) ??
                        false);

                if (m.path && m.currentWaypointIdx < m.path.length) {
                    // Smooth waypoint advancement. Reached distance is
                    // bodyHalf + a small breathing-room offset so a
                    // flush waypoint parked against a wall doesn't
                    // perpetually count as "arrived" while the monster
                    // still has the body box clipping the corner.
                    const currWp = m.path[m.currentWaypointIdx];
                    if (currWp) {
                        const distToWp = Math.hypot(footPos.x - currWp.x, footPos.y - currWp.y);
                        if (
                            isWaypointReached(distToWp, monsterBodyHalfH) &&
                            m.currentWaypointIdx < m.path.length - 1
                        ) {
                            m.currentWaypointIdx++;
                        }
                    }
                    const targetWp = m.path[m.currentWaypointIdx] ?? targetPos;
                    targetDir = dirTo(footPos, targetWp);
                } else if (hasLoS) {
                    // Clear sight and no remaining path waypoints → direct straight line
                    targetDir = dirTo(footPos, targetPos);
                } else {
                    targetDir = dirTo(footPos, targetPos);
                }

                const isFollowingPath = !!m.path && m.currentWaypointIdx < m.path.length;

                // Base chase vector
                const cv = chaseVelocity(targetDir, this.phaseSpeed(m));
                desiredVx = cv.vx;
                desiredVy = cv.vy;

                // Separation is intentionally OFF while following a
                // path — when two monsters route through the same
                // corner cell, an extra repulsion push makes them
                // jitter across each other and never reach the
                // waypoint. The path itself keeps them spread across
                // cells; off-path straight-line chases get a small
                // separation force to stop identical-position overlap.
                if (!isFollowingPath) {
                    const sep = calcSeparationForce(m, this.monsters, 32, this.phaseSpeed(m) * 0.4);
                    desiredVx += sep.x;
                    desiredVy += sep.y;
                }

                // Anti-blocking Detour: check if an ally directly ahead is stationary / attacking
                for (const ally of this.monsters) {
                    if (ally === m || ally.dead) continue;
                    const allyPos = ally.body.position;
                    const distToAlly = distBetween(mp, allyPos);
                    if (distToAlly < 28) {
                        const dirToAlly = dirTo(mp, allyPos);
                        const dot = targetDir.x * dirToAlly.x + targetDir.y * dirToAlly.y;
                        // Ally is directly in front (dot > 0.6) and is attacking or stopped
                        if (dot > 0.6 && (ally.state === 'attack' || ally.state === 'idle')) {
                            // Tangential detour vector perpendicular to targetDir
                            const sign = i % 2 === 0 ? 1 : -1;
                            const detourX = -targetDir.y * sign * this.phaseSpeed(m) * 0.6;
                            const detourY = targetDir.x * sign * this.phaseSpeed(m) * 0.6;
                            desiredVx += detourX;
                            desiredVy += detourY;
                            break;
                        }
                    }
                }

                // Emergency Escape: if stuck, disable direct LoS shortcut and force fresh A* path
                if (isStuckEmergency || m.stuckTicks >= 2) {
                    m.noLoSUntil = time + 2000;
                    m.path = null;
                    m.stuckTicks = 0;
                }

                // Cap total desired velocity to preserve move speed limit
                const speed = Math.hypot(desiredVx, desiredVy);
                const maxAllowedSpeed = this.phaseSpeed(m) * 1.15;
                if (speed > maxAllowedSpeed) {
                    desiredVx = (desiredVx / speed) * maxAllowedSpeed;
                    desiredVy = (desiredVy / speed) * maxAllowedSpeed;
                }
            } else {
                m.path = null;
                m.currentWaypointIdx = 0;
            }

            // Direct Velocity Execution when following A* path (100% path commitment, no wall friction)
            const isFollowingPath = !!m.path && m.currentWaypointIdx < m.path.length;
            if (time < m.hitStunUntil) {
                // In hit-stun from knockback: let impulse carry the monster, skip steering overwrite
            } else if (isFollowingPath && time >= m.wallEscapeUntil) {
                this.matter.Body.setVelocity(m.body, { x: desiredVx, y: desiredVy });
            } else if (time >= m.wallEscapeUntil) {
                const currVx = m.body.velocity.x;
                const currVy = m.body.velocity.y;
                const lerpFactor = 0.22;
                const finalVx = currVx + (desiredVx - currVx) * lerpFactor;
                const finalVy = currVy + (desiredVy - currVy) * lerpFactor;
                this.matter.Body.setVelocity(m.body, { x: finalVx, y: finalVy });
            }

            // ── Attack tick ──────────────────────────────────────────
            // A boss swings on its phase's rhythm: never faster than the weapon
            // allows, never faster than the gap the design table gives it.
            const attackGap = m.spec.boss
                ? Math.max(m.weapon.cooldownMs, this.phaseOf(m).gapMs)
                : m.weapon.cooldownMs;
            // A boss swings on RHYTHM, not on her AI state.
            //
            // `state === 'attack'` kept coming out false in play (`还是Claude且没有攻击`): her
            // state depends on a weapon range that can disagree with where she actually stands,
            // and the whole fight then becomes a statue. For a boss the question is only "is
            // the player close enough, and am I off cooldown".
            const bossInReach = m.spec.boss && dist <= BOSS_ENGAGE_RANGE_PX;
            // The intro comic is on top of the canvas: the player cannot see or dodge, so the
            // fight has not started yet. Without this she swung through the pages and the
            // owner walked out of the comic already dead
            // (`如果多看一会漫画的话进入boss战就直接死亡了`).
            const comicOpen = useGameStore.getState().comicIntroLevelId !== null;
            if (
                !comicOpen &&
                (bossInReach || (!m.spec.boss && m.state === 'attack')) &&
                this.isVulnerable(m, time) &&
                time - m.lastAttackAt >= attackGap
            ) {
                this.performAttack(m, dirToPlayer, footY);
                m.lastAttackAt = time;
            }
            // `?bossDebug=1` prints why she is or is not swinging. The whole attack path was
            // reported dead in play (`boss不会攻击`) and every number needed to tell "she never
            // got in range" from "she fired and nothing came out" is in this one line.
            if (
                m.spec.boss &&
                typeof window !== 'undefined' &&
                window.location.search.includes('bossDebug')
            ) {
                (window as unknown as { __bossDebug?: unknown }).__bossDebug = {
                    phase: m.phaseIndex + 1,
                    hp: Math.round(m.hp),
                    maxHp: Math.round(m.phaseMaxHp),
                    state: m.state,
                    dist: Math.round(dist),
                    range: Math.round(m.weapon.range),
                    gapMs: Math.round(attackGap),
                    sinceAttackMs: Math.round(time - m.lastAttackAt),
                    invulnerableMs: Math.round(Math.max(0, m.invulnerableUntil - time)),
                    lastAttack: m.lastBossAttack ?? '-',
                    shots: this.bossShots,
                    // Her shells now live at depth 1e6, so the layer can be counted from the
                    // scene: a number above zero with nothing on screen means the drawing is
                    // wrong, and zero means the spawn never happened.
                    bullets: this.scene.children.list.filter(
                        (child) => (child as { depth?: number }).depth === 1_000_000,
                    ).length,
                };
            }

            // ── Visual sync & animation ───────────────────────────────
            // Align feet shadow and green debug rect with actual feet position
            m.shadow.setPosition(footX, footY);
            m.shadow.setDepth(footY - 1);
            m.debugBodyRect.setPosition(footX, footY - m.spec.body.halfH);

            if (m.sprite) {
                // Calculate visual offset. `left` shifts right (+) / left (-), `bottom` shifts up (-) / down (+)
                const rawX = m.spec.sprite?.offset?.left ?? m.spec.sprite?.offset?.x ?? 0;
                const rawY =
                    m.spec.sprite?.offset?.bottom !== undefined
                        ? -m.spec.sprite.offset.bottom
                        : (m.spec.sprite?.offset?.y ?? 0);
                const offX = rawX * (m.sprite.flipX ? -1 : 1);
                const offY = rawY;

                // Align sprite with feet and apply offset
                m.sprite.setPosition(mp.x + offX, mp.y + offY);
                m.sprite.setDepth(footY);

                // Hit flash visual feedback (50% additive white highlight via Phaser 4 TintModes.ADD = 2)
                const isHitFlashing = time < m.hitFlashUntil;
                if (isHitFlashing) {
                    m.sprite.setTint(0x808080);
                    (m.sprite as any).setTintMode?.(2);
                } else if ((m.sprite as any).tintMode !== 0) {
                    m.sprite.clearTint();
                    (m.sprite as any).setTintMode?.(0);
                }
                m.weaponVisual?.setHitFlash(isHitFlashing);

                // Align Editor debug rect & sensor hitbox directly with sprite position
                m.debugHitboxRect.setPosition(mp.x + offX, mp.y + offY);
                if (m.hitboxBody) {
                    this.matter.Body.setPosition(m.hitboxBody, { x: mp.x + offX, y: mp.y + offY });
                }

                // Update status HUD above monster Red Hitbox top edge
                const topOffset = m.hitboxHeight / 2;
                m.statusHud.update(
                    {
                        // Chinese runs show 藤壶炮手, English runs show Barnacle Gunner. The
                        // label used the English name directly, which is why every monster
                        // had an English name over its head in a Chinese game.
                        name: this.plateName(m.spec, m.phaseIndex),
                        hp: m.hp,
                        maxHp: m.phaseMaxHp,
                        showHpBar: true,
                        ...(m.spec.boss ? this.bossPlateStyle(m.phaseIndex) : {}),
                        ...(m.spec.boss
                            ? { phaseIndex: m.phaseIndex, phaseCount: BOSS_PHASES.length }
                            : {}),
                    },
                    time,
                    topOffset,
                );

                // Play corresponding animation track (idle / move / hit)
                const isHit = time - m.lastHitAt < 250;

                // The `turn` track plays exactly once, on the idle -> chase
                // transition: she notices you, turns, then runs. A monster whose
                // YAML has no `turn` simply skips it, so nothing else changes.
                const turnKey = animKey(m.spec, 'turn');
                const hasTurn = this.scene.anims.exists(turnKey);
                const chasing = m.state === 'chase';
                if (hasTurn && chasing && !m.wasChasing) {
                    m.turnUntil = time + (this.scene.anims.get(turnKey)?.duration ?? 0);
                }
                m.wasChasing = chasing;

                // No-art fall beat: drive the alpha here, every frame, so nothing else can
                // walk over it. `fallFade` is cleared the moment the pause is over.
                // The fall beat, driven frame by frame: the sheet's `death` track is the crouch
                // row, so the tilt is what makes it read as going down. Alpha fades the tail out
                // so the next form arrives out of darkness rather than mid-pose.
                if (m.fallUntil > 0) {
                    if (m.sprite && time < m.fallUntil) {
                        const progress = 1 - (m.fallUntil - time) / BOSS_FALL_MS;
                        m.sprite.setAlpha(bossFallAlpha(progress));
                        m.sprite.setAngle(bossFallTilt(progress));
                    } else if (m.sprite) {
                        // Stand up: undo both, or the next phase fights at 80 degrees.
                        m.sprite.setAlpha(1);
                        m.sprite.setAngle(0);
                        m.fallUntil = 0;
                        m.fallFade = false;
                    }
                }

                const animTrack = monsterAnimTrack({
                    isHit,
                    hasTurn,
                    turnUntil: m.turnUntil,
                    now: time,
                    chasing,
                    fallUntil: m.fallUntil,
                });
                // The fall track IS the death clip: she goes down, lies there for the whole
                // inter-phase pause, then the next form stands up.
                const currentTrackKey = animKey(m.spec, animTrack === 'fall' ? 'death' : animTrack);
                if (
                    this.scene.anims.exists(currentTrackKey) &&
                    m.sprite.anims.currentAnim?.key !== currentTrackKey
                ) {
                    m.sprite.play(currentTrackKey);
                }

                // Flip sprite horizontally based on move direction / facing player
                // A prop never turns to face the player — its art is anchored to
                // the scenery, so flipping it would break the alignment.
                if (!m.spec.prop && dist > 1) {
                    m.sprite.setFlipX(dirToPlayer.x < 0);
                }
            } else {
                m.debugHitboxRect.setPosition(mp.x, mp.y);
                const halfH = m.spec.body.halfH;
                m.statusHud.update(
                    {
                        name: this.plateName(m.spec, m.phaseIndex),
                        hp: m.hp,
                        maxHp: m.phaseMaxHp,
                        showHpBar: true,
                        ...(m.spec.boss ? this.bossPlateStyle(m.phaseIndex) : {}),
                        ...(m.spec.boss
                            ? { phaseIndex: m.phaseIndex, phaseCount: BOSS_PHASES.length }
                            : {}),
                    },
                    time,
                    halfH,
                );
                if (dist > 1) {
                    m.debugHitboxRect.setRotation(Math.atan2(dirToPlayer.y, dirToPlayer.x));
                }
            }

            // ── Weapon visual sync (Brotato-style floating attachment) ──
            // Aim the held weapon at the player the same way WeaponController
            // does for the player character. Mirrors player visual behaviour.
            // Pass `footY + 20` (matches DEPTH.WEAPON - DEPTH.CHARACTER on
            // the flat layer) so the weapon sits in front of the monster's
            // bullet and body — sprite < bullet < weapon ordering, same as
            // the player stack.
            if (m.weaponVisual) {
                const handX = mp.x;
                const handY = mp.y;
                const aimAngle = Math.atan2(dirToPlayer.y, dirToPlayer.x);
                m.weaponVisual.update(handX, handY, aimAngle, footY + 20);
            }
        }

        // ── Projectile visual sync + cleanup ──────────────────────────
        // Mirrors WeaponController's bullet lifecycle: retire ranged
        // bullets that have slowed below a small threshold (usually
        // they hit something or slid to a stop against a tall wall) OR
        // flown past their effective range from the spawn point. Without
        // this, missed shots lingered in the world until something else
        // killed them — eventually every level's projectile pool grew
        // unbounded over a long run.
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const bp = proj.body.position;
            const vel = proj.body.velocity;

            // Bullet depth tracks the firing monster's current footY
            // (sprite < bullet < weapon ordering, same as the player).
            // When the owner dies or starts dying mid-flight we can't
            // keep tracking it — pin to the fire-time depth instead so
            // the bullet doesn't snap to depth 0 or stale.
            const owner = proj.monster;
            const ownerAlive = owner && !owner.dead && owner.state !== 'dying';
            const bulletFootY = ownerAlive ? MonsterController.computeFootY(owner) : proj.fireFootY;
            proj.rect.setDepth(bulletFootY + 10);

            proj.rect.setPosition(bp.x, bp.y);
            proj.rect.setRotation(Math.atan2(vel.y, vel.x));

            const currentSpeed = Math.hypot(vel.x, vel.y);
            const dx = bp.x - proj.originX;
            const dy = bp.y - proj.originY;
            const distSq = dx * dx + dy * dy;
            // Hard cap on lifetime (per-weapon via projectile.lifeMs,
            // default 1500ms) — kills missed shots that would otherwise
            // linger ~4-10s while Matter friction decays speed.
            const expired = time - proj.spawnAt >= proj.lifeMs;
            if (expired || currentSpeed < 1.0 || distSq >= proj.maxDistance * proj.maxDistance) {
                this.destroyProjectile(proj);
            }
        }

        // Combo timeout tracking (reset to 0 after 3.0s without hits)
        if (this.currentCombo > 0 && time - this.lastComboHitAt > 3000) {
            this.currentCombo = 0;
            EventBus.emit('combat:combo', { count: 0, resetAt: 0 });
        }

        // 剩余怪物数: once per frame, AFTER the loop has removed the dead and spawned the
        // pending. It was briefly wired to the end of `performMelee`, which meant the counter
        // only moved when something swung at the player.
        this.publishRemaining();
    }

    /** Inject the player character's luck stat so crit calculations use
     *  the correct value after a character swap (tavern phase 2). */
    setPlayerLuck(luck: number): void {
        this.playerLuck = Math.max(1, Math.min(10, Math.floor(luck)));
    }

    /** Apply damage from a player bullet to a specific monster (or AoE later). */
    applyBulletDamage(
        bulletDamage: number,
        hitBody: MatterJS.BodyType,
        bulletBody?: MatterJS.BodyType,
    ): void {
        // Find monster whose main body or compound parts match hitBody
        const target =
            this.monsters.find((m) => {
                if (m.dead || m.state === 'dying') return false;
                if (m.body === hitBody) return true;
                // Check compound parts if any (includes spriteHitbox sensor)
                const parts = (m.body as any).parts;
                if (Array.isArray(parts) && parts.includes(hitBody)) return true;
                // Fallback: check parent
                if ((hitBody as any).parent === m.body) return true;
                return false;
            }) ?? pickClosestMonster(hitBody.position, this.monsters, 200);

        if (target && target.state !== 'dying') {
            // Crit: (luck/10) * COMBAT_CRIT_MULTIPLIER probability,
            // COMBAT_CRIT_DAMAGE_MULTIPLIER × damage, gold floating number.
            const isCrit =
                !getCheats().oneHitKill &&
                Math.random() < (this.playerLuck / 10) * COMBAT_CRIT_MULTIPLIER;
            const rawDamage = getCheats().oneHitKill
                ? 999999
                : isCrit
                  ? bulletDamage * COMBAT_CRIT_DAMAGE_MULTIPLIER
                  : bulletDamage;
            // Boss armour soaks flat, after the crit multiplier: a crit still hits
            // the same armour, it just arrives bigger.
            let finalDamage = damageAfterArmor(rawDamage, target.spec.armor ?? 0);
            // A boss shrugs off a tenth at most: no edited save or tuned weapon can
            // skip a phase of the descent.
            if (target.spec.boss) {
                finalDamage = clampBossDamage(finalDamage, target.phaseMaxHp);
            }
            if (finalDamage <= 0) return;
            target.hp -= finalDamage;
            target.lastHitAt = this.scene.time.now;
            target.hitFlashUntil = this.scene.time.now + COMBAT_HIT_FLASH_MS;
            if (target.sprite) {
                target.sprite.setTint(0x808080);
                (target.sprite as any).setTintMode?.(2);
            }
            target.weaponVisual?.setHitFlash(true);
            target.statusHud.showFloatingNumber(finalDamage, isCrit ? 'crit' : 'damage');
            EventBus.emit(SFX_EVENT(target.spec.sfx?.hit ?? 'monster-hit'), {
                key: `monster:${target.spec.id}`,
                throttleMs: target.spec.sfx?.throttleMs,
            });

            // Combo hit registration (3.0s window)
            const hitTime = this.scene.time.now;
            if (hitTime - this.lastComboHitAt <= 3000) {
                this.currentCombo++;
            } else {
                this.currentCombo = 1;
            }
            this.lastComboHitAt = hitTime;
            EventBus.emit('combat:combo', { count: this.currentCombo, resetAt: hitTime + 3000 });

            // 1. Knockback impulse & Hit-stun (subtle flinch impulse, capped without compounding)
            const bulletVel = (bulletBody as any)?.bulletVelocity ?? bulletBody?.velocity;
            const fallbackDir = dirTo(this.playerBody.position, target.body.position);
            const kb = calcKnockbackVelocity(bulletVel, fallbackDir, finalDamage);
            this.matter.Body.setVelocity(target.body, {
                x: kb.vx,
                y: kb.vy,
            });
            target.hitStunUntil = this.scene.time.now + COMBAT_HIT_STUN_MS;

            // 2. Micro hit sparks and falling mosaic chips at impact point
            const sparkX = bulletBody?.position?.x ?? target.body.position.x;
            const sparkY = bulletBody?.position?.y ?? target.body.position.y;
            const hitPos = { x: sparkX, y: sparkY };
            spawnHitSparks(this.scene, sparkX, sparkY, {
                dir: { x: kb.vx, y: kb.vy },
                isCrit,
            });

            // 3. Screen shake on critical hits (controlled & subtle)
            if (isCrit) {
                this.scene.cameras.main.shake(
                    COMBAT_SCREEN_SHAKE_CRIT.duration,
                    COMBAT_SCREEN_SHAKE_CRIT.intensity,
                );
            }

            // 4. AoE explosion if bullet specifies aoeRadius
            const aoeRadius = (bulletBody as any)?.aoeRadius;
            if (typeof aoeRadius === 'number' && aoeRadius > 0) {
                this.scene.cameras.main.shake(
                    COMBAT_SCREEN_SHAKE_EXPLOSION.duration,
                    COMBAT_SCREEN_SHAKE_EXPLOSION.intensity,
                );

                // Expanding visual shockwave ring
                const circle = this.scene.add.circle(hitPos.x, hitPos.y, 8, 0xffffff, 0.4);
                circle.setDepth(DEPTH.BULLET + 40);
                circle.setStrokeStyle(2, 0xf59e0b, 0.85);
                this.scene.tweens.add({
                    targets: circle,
                    radius: aoeRadius,
                    alpha: 0,
                    duration: 180,
                    ease: 'Cubic.out',
                    onComplete: () => circle.destroy(),
                });

                for (const otherM of this.monsters) {
                    if (otherM === target || otherM.dead || otherM.state === 'dying') continue;
                    const d = distBetween(hitPos, otherM.body.position);
                    if (d <= aoeRadius) {
                        const falloff = 1 - (d / aoeRadius) * 0.4;
                        const splashDamage = damageAfterArmor(
                            Math.max(1, Math.round(finalDamage * falloff)),
                            otherM.spec.armor ?? 0,
                        );
                        if (splashDamage <= 0) continue;
                        const splashed = otherM.spec.boss
                            ? clampBossDamage(splashDamage, otherM.phaseMaxHp)
                            : splashDamage;
                        otherM.hp -= splashed;
                        otherM.lastHitAt = this.scene.time.now;
                        otherM.hitFlashUntil = this.scene.time.now + COMBAT_HIT_FLASH_MS;
                        if (otherM.sprite) {
                            otherM.sprite.setTint(0x808080);
                            (otherM.sprite as any).setTintMode?.(2);
                        }
                        otherM.weaponVisual?.setHitFlash(true);
                        otherM.statusHud.showFloatingNumber(splashed, 'damage');
                        const outDir = dirTo(hitPos, otherM.body.position);
                        this.matter.Body.setVelocity(otherM.body, {
                            x: outDir.x * 1.5,
                            y: outDir.y * 1.5,
                        });
                        otherM.hitStunUntil = this.scene.time.now + COMBAT_HIT_STUN_MS;
                        if (this.barCleared(otherM)) {
                            if (otherM.spec.boss) {
                                this.advancePhase(otherM);
                                continue;
                            }
                            this.kill(otherM);
                        }
                    }
                }
            }

            if (this.barCleared(target)) {
                // Bosses climb a rung instead of dying; everyone else dies here.
                if (target.spec.boss) {
                    this.advancePhase(target);
                } else {
                    this.kill(target);
                }
            }

            // 5. 秘法杖连锁：命中后跳向最近的其它怪物，第二只 70%、第三只 40%。
            const chain = (bulletBody as any)?.chain as
                { count: number; scales: readonly number[]; maxDistance?: number } | undefined;
            if (chain && chain.count > 0) {
                this.applyChain(hitPos, target, finalDamage, chain);
            }

            // 6. 鲸娘重炮二段：0.1 秒后同一处落下天谴轰炸圈，伤害与首发相同。
            const secondaryBlastMs = (bulletBody as any)?.secondaryBlastMs as number | undefined;
            const blastRadius = (bulletBody as any)?.secondaryBlastRadius as number | undefined;
            if (
                typeof secondaryBlastMs === 'number' &&
                secondaryBlastMs > 0 &&
                typeof aoeRadius === 'number' &&
                aoeRadius > 0
            ) {
                this.scheduleSecondaryBlast(
                    hitPos,
                    typeof blastRadius === 'number' && blastRadius > 0 ? blastRadius : aoeRadius,
                    finalDamage,
                    secondaryBlastMs,
                );
            }
        }
    }

    /**
     * 秘法杖的连锁：从命中点开始，依次跳向最近的、还没被这次连锁打过的怪物。
     *
     * `scales[i]` 是第 i+1 跳的伤害比例（主人：第一只 100%、第二只 70%、第三只 40%，
     * 第一只就是本体，直接走原来的命中流程，所以这里只处理后面几跳）。
     * 每一跳都画一条电弧，让"打到了谁"在屏幕上看得见。
     */
    private applyChain(
        from: { x: number; y: number },
        primary: Monster,
        damage: number,
        chain: { count: number; scales: readonly number[]; maxDistance?: number },
    ): void {
        const struck: Monster[] = [primary];
        let anchor = from;
        // 主人在意的是"别跳到地图另一头"：两段加起来不超过半屏就继续，超了直接收手。
        let travelBudget = chain.maxDistance ?? Number.POSITIVE_INFINITY;

        for (let jump = 0; jump < chain.count; jump += 1) {
            let next: Monster | null = null;
            let bestDistance = Number.POSITIVE_INFINITY;
            for (const other of this.monsters) {
                if (other.dead || other.state === 'dying' || struck.includes(other)) continue;
                const d = distBetween(anchor, other.body.position);
                if (d < bestDistance) {
                    bestDistance = d;
                    next = other;
                }
            }
            if (!next) return;
            if (bestDistance > travelBudget) return;
            travelBudget -= bestDistance;

            const scale = chain.scales[jump] ?? chain.scales[chain.scales.length - 1] ?? 0;
            const amount = damageAfterArmor(
                Math.max(1, Math.round(damage * scale)),
                next.spec.armor ?? 0,
            );
            const target = next;
            struck.push(target);

            // 电弧：从上一跳的落点连到这一只。
            const bolt = this.scene.add.line(
                0,
                0,
                anchor.x,
                anchor.y,
                target.body.position.x,
                target.body.position.y,
                0xa855f7,
            );
            bolt.setOrigin(0, 0);
            bolt.setLineWidth(3, 0.95);
            bolt.setDepth(DEPTH.BULLET + 42);
            this.scene.tweens.add({
                targets: bolt,
                alpha: 0,
                duration: 220,
                onComplete: () => bolt.destroy(),
            });
            anchor = { x: target.body.position.x, y: target.body.position.y };

            if (amount <= 0) continue;
            const applied = target.spec.boss ? clampBossDamage(amount, target.phaseMaxHp) : amount;
            target.hp -= applied;
            target.lastHitAt = this.scene.time.now;
            target.hitFlashUntil = this.scene.time.now + COMBAT_HIT_FLASH_MS;
            if (target.sprite) {
                target.sprite.setTint(0x808080);
                (target.sprite as any).setTintMode?.(2);
            }
            target.weaponVisual?.setHitFlash(true);
            target.statusHud.showFloatingNumber(applied, 'damage');
            if (this.barCleared(target)) {
                if (target.spec.boss) {
                    this.advancePhase(target);
                } else {
                    this.kill(target);
                }
            }
        }
    }

    /**
     * 鲸娘重炮的二段爆破：首弹命中后，隔 `delayMs` 在同一处铺开一个红色的天谴轰炸圈，
     * 圈内的怪物各吃一次和炮弹相同的伤害（不再按距离衰减，主人要的是"一样"）。
     */
    private scheduleSecondaryBlast(
        at: { x: number; y: number },
        radius: number,
        damage: number,
        delayMs: number,
    ): void {
        this.scene.time.delayedCall(delayMs, () => {
            if (this.destroyed) return;

            this.scene.cameras.main.shake(
                COMBAT_SCREEN_SHAKE_EXPLOSION.duration,
                COMBAT_SCREEN_SHAKE_EXPLOSION.intensity,
            );

            const ring = this.scene.add.circle(at.x, at.y, radius * 0.3, 0xff2d2d, 0.28);
            ring.setDepth(DEPTH.BULLET + 41);
            ring.setStrokeStyle(3, 0xff4d4d, 0.95);
            this.scene.tweens.add({
                targets: ring,
                radius,
                alpha: 0.65,
                duration: 170,
                ease: 'Cubic.out',
                onComplete: () => ring.destroy(),
            });

            for (const other of this.monsters) {
                if (other.dead || other.state === 'dying') continue;
                if (distBetween(at, other.body.position) > radius) continue;
                const amount = damageAfterArmor(
                    Math.max(1, Math.round(damage)),
                    other.spec.armor ?? 0,
                );
                if (amount <= 0) continue;
                const applied = other.spec.boss
                    ? clampBossDamage(amount, other.phaseMaxHp)
                    : amount;
                other.hp -= applied;
                other.lastHitAt = this.scene.time.now;
                other.hitFlashUntil = this.scene.time.now + COMBAT_HIT_FLASH_MS;
                if (other.sprite) {
                    other.sprite.setTint(0x808080);
                    (other.sprite as any).setTintMode?.(2);
                }
                other.weaponVisual?.setHitFlash(true);
                other.statusHud.showFloatingNumber(applied, 'damage');
                if (this.barCleared(other)) {
                    if (other.spec.boss) {
                        this.advancePhase(other);
                    } else {
                        this.kill(other);
                    }
                }
            }
        });
    }

    /**
     * GPT's dragon roar: every monster the camera can currently see loses a
     * share of its MAX HP, right now. Deliberately a share of MAX rather than
     * of what is left, so the roar is always the same halving — and anything
     * already below that line dies outright.
     *
     * Reached by event, not by a direct call: the character pays for the roar
     * and announces it, the monsters own their own HP.
     */
    applyRoarDamage(hpFraction: number): void {
        // The handler is subscribed on the EventBus, which outlives the scene.
        // A controller whose scene has been torn down must stay mute —
        // otherwise a skill press in a later level wakes it and it walks a
        // dead display list.
        if (this.destroyed) return;
        const view = this.scene.cameras.main.worldView;
        for (const m of this.monsters) {
            if (m.dead || m.state === 'dying') continue;
            const { x, y } = m.body.position;
            if (!view.contains(x, y)) continue;

            const rolled = roarDamageFor(m.spec.hp, hpFraction, isRoarBoss(m.spec));
            const amount = m.spec.boss ? clampBossDamage(rolled, m.phaseMaxHp) : rolled;
            m.hp -= amount;
            m.lastHitAt = this.scene.time.now;
            m.hitFlashUntil = this.scene.time.now + COMBAT_HIT_FLASH_MS;
            if (m.sprite) {
                m.sprite.setTint(0x808080);
                (m.sprite as any).setTintMode?.(2);
            }
            m.weaponVisual?.setHitFlash(true);
            m.statusHud.showFloatingNumber(amount, 'damage');
            if (this.barCleared(m)) {
                if (m.spec.boss) {
                    this.advancePhase(m);
                } else {
                    this.kill(m);
                }
            }
        }

        // One hit for the whole room, throttled under a single key so a screen
        // full of monsters does not stack a chorus of them.
        this.scene.cameras.main.shake(
            COMBAT_SCREEN_SHAKE_EXPLOSION.duration,
            COMBAT_SCREEN_SHAKE_EXPLOSION.intensity,
        );
        EventBus.emit(SFX_EVENT('monster-hit'), { key: 'skill:dragon-roar', throttleMs: 120 });
    }

    setDebugVisible(visible: boolean): void {
        for (const m of this.monsters) {
            m.debugBodyRect.setVisible(visible);
            m.debugHitboxRect.setVisible(visible);
        }
    }

    destroy(): void {
        this.destroyed = true;
        this.roarCleanup?.();
        this.roarCleanup = undefined;
        for (const m of this.monsters) m.destroy(this.scene);
        for (const p of this.projectiles) {
            safeRemoveBody(this.scene?.matter?.world ?? null, p.body);
            p.rect.destroy();
        }
        this.monsters.length = 0;
        this.projectiles.length = 0;
    }

    // ─── internals ──────────────────────────────────────────────────────

    /** The rung this monster is standing on. Always phase 1 for non-bosses. */
    /** The name plate: 灭世·克劳德, 神·克劳德… and plain 克劳德 in the last form. */
    /** Boss plate: bigger, and coloured by phase so the prefix reads instantly. */
    private bossPlateStyle(phaseIndex: number): {
        nameColor: string;
        nameStroke: string;
        nameSizePx: number;
    } {
        const colour = bossPhaseNameColour(phaseIndex);
        return { nameColor: colour.fill, nameStroke: colour.stroke, nameSizePx: BOSS_NAME_FONT_PX };
    }

    private plateName(
        spec: { name: string; nameZh?: string; boss?: boolean },
        phaseIndex: number,
    ): string {
        const base = monsterDisplayName(spec);
        if (!spec.boss) return base;
        const locale = useGameStore.getState().locale === 'zh-CN' ? 'zh' : 'en';
        return bossPhaseTitle(phaseIndex, base, locale);
    }

    private phaseOf(m: Monster): BossPhase {
        return m.spec.boss ? phaseAt(m.phaseIndex) : phaseAt(0);
    }

    /** Chase speed for the current phase. Unscaled for ordinary monsters. */
    private phaseSpeed(m: Monster): number {
        const phase = this.phaseOf(m);
        // `moveBonus` 是叠加在倍率之后的平值（主人 2026-11-15：初始移速 +1）。
        return m.spec.moveSpeed * phase.moveScale + (phase.moveBonus ?? 0);
    }

    /** Attack damage for the current phase. */
    private phaseDamage(m: Monster, base: number): number {
        return base * this.phaseOf(m).damageScale;
    }

    /**
     * Emptying a boss's bar does not end the fight - it ends the PHASE.
     *
     * The new form arrives with a full pool, an invulnerable beat in which she plays
     * her turn animation, and no attack of her own. Only the last rung is fatal.
     */
    /** Hand-written per-phase landing spots, from `level.arenaSpawn`. */
    private bossSpawns: { x: number; y: number }[] = [];

    setBossSpawns(spots?: { x: number; y: number }[]): void {
        this.bossSpawns = spots ?? [];
    }

    /**
     * Has this bar reached the point where the phase ends?
     *
     * Every phase has to be emptied - except the last one, which ends at half
     * (`phaseEndHp`). The owner caught her running the last bar down to zero.
     */
    private barCleared(m: Monster): boolean {
        return m.hp <= phaseEndHp(m.phaseIndex, m.phaseMaxHp, BOSS_PHASES.length);
    }

    /**
     * Move her to the next arena block, on her own.
     *
     * The walk-through-the-arrow flow is the player's route; the BOSS was supposed to be
     * booked at the next landing spot by `BossArenaLoop`, but in play she simply picked the
     * next phase up where she died (`直接接着上一阶段阵亡就开打了`). Doing it here makes the
     * move a property of the phase change itself, not of a route the player might skip.
     */
    private relocateBoss(m: Monster): void {
        // Phases 1 and 2 are fought at the same spot on purpose - she comes back where she
        // fell (`第二阶段神·Claude直接接续上灭世·Claude，原地复活`). The move starts at 半神.
        if (m.phaseIndex <= 1) return;
        const index = arenaSpotIndexForPhase(m.phaseIndex, this.bossSpawns.length);
        const spot = index === null ? null : this.bossSpawns[index];
        if (!spot) return;
        const phys = this.matter as unknown as {
            Body?: { setPosition: (b: unknown, p: { x: number; y: number }) => void };
        };
        phys.Body?.setPosition(m.body, { x: spot.x, y: spot.y });
        m.sprite?.setPosition(spot.x, spot.y);
    }

    /** 出生就把这一关该打的那一阶段套上（血量 / 体型 / 伤害倍率都跟着走）。 */
    private applyBossStartPhase(m: Monster): void {
        if (!m.spec.boss) return;
        const index = bossStartPhaseIndex(this.bossPhase);
        m.phaseIndex = index;
        if (m.sprite?.frame?.height) {
            m.sprite.setScale(phaseSpriteScale(m.sprite.frame.height, index));
        }
        const stats = scaleForPhase(
            { hp: m.spec.hp, moveSpeed: m.spec.moveSpeed, damage: 1 },
            phaseAt(index),
        );
        m.phaseMaxHp = stats.hp;
        m.hp = stats.hp;
        m.lastBossAttack = null;
        m.wrathWaves = 0;
        m.bossRounds = 0;
    }

    private advancePhase(m: Monster): void {
        // A cleared bar is a checkpoint: the player gets a full magazine and reserve back on
        // every weapon, and from phase four on their health and spirit too. Announced before
        // the branch, so the last (fatal) bar pays out as well - the owner asked for the
        // vitals refill on phase four's clear, not on the kill.
        EventBus.emit(BOSS_PHASE_CLEAR_EVENT, {
            id: m.spec.id,
            clearedIndex: m.phaseIndex,
            phaseCount: BOSS_PHASES.length,
        });

        const upcoming = nextPhase(m.phaseIndex);
        // 一关一阶段：这一关的那条血清空即终局，不再原地变身（`四关匹配 4 阶段`）。
        if (!upcoming || bossPhaseIsFinal(this.bossPhase, m.phaseIndex)) {
            this.kill(m);
            return;
        }

        // 灭世 -> 神: she goes down, stays down for `BOSS_FALL_MS`, then gets up stronger.
        // The fall uses the same death track the final form ends on, at the phase-one scale,
        // slowed until it fills the pause.
        const falling = m.phaseIndex === 0;
        // Always logged, before any branch: if this never appears, the transition did not come
        // through here at all, which is a different bug from "the branch skipped the pause".
        recordBossTrace({
            id: m.spec.id,
            stage: 'advance',
            from: m.phaseIndex,
            to: upcoming.id,
            falling,
            hasSprite: !!m.sprite,
            now: Math.round(this.scene.time.now),
        });

        m.phaseIndex += 1;
        this.relocateBoss(m);
        if (m.sprite?.frame?.height) {
            m.sprite.setScale(phaseSpriteScale(m.sprite.frame.height, m.phaseIndex));
        }
        const stats = scaleForPhase(
            { hp: m.spec.hp, moveSpeed: m.spec.moveSpeed, damage: 1 },
            upcoming,
        );
        m.phaseMaxHp = stats.hp;
        m.hp = stats.hp;
        // The fall IS the pause, not an extra wait on top of it: 3 s of body on the floor.
        m.invulnerableUntil =
            this.scene.time.now + (falling ? BOSS_FALL_MS : BOSS_PHASE_TRANSITION_MS);
        m.lastAttackAt = m.invulnerableUntil;
        m.hitStunUntil = m.invulnerableUntil;
        // Entropy resets per phase; so does "do not repeat that attack".
        m.lastBossAttack = null;
        m.wrathWaves = 0;
        m.bossRounds = 0;

        // The turn track is the one animation every boss sheet already has, so the
        // transformation reads even before bespoke phase art exists.
        if (falling && m.sprite) {
            // The pause belongs to the phase change, not to the art: set the frozen track FIRST,
            // so a sheet without a death clip (ours has idle/walk/run/dodge only) still spends
            // the beat lying still instead of cutting straight to the new form.
            m.fallUntil = m.invulnerableUntil;
            const deathKey = animKey(m.spec, 'death');
            const turnKey = animKey(m.spec, 'turn');
            const plan = bossFallPlan({
                hasDeath: this.scene.anims.exists(deathKey),
                hasTurn: this.scene.anims.exists(turnKey),
            });
            const clip = plan === 'death' ? this.scene.anims.get(deathKey) : null;
            if (plan === 'fade') {
                // No fall art at all: the per-frame alpha curve carries the beat. A tween was
                // tried first and the sprite's other writers could walk over it, which put us
                // straight back at a jump-cut.
                m.fallFade = true;
            }
            recordBossTrace({
                id: m.spec.id,
                stage: 'fall-branch',
                from: m.phaseIndex - 1,
                to: upcoming.id,
                plan: plan,
                hasSprite: !!m.sprite,
                frozenMs: m.invulnerableUntil - this.scene.time.now,
            });
            if (clip) {
                // Slowed so the clip itself lasts the whole pause: timeScale < 1 stretches
                // it, and `fallUntil` keeps the per-frame track picker on `death` for the
                // same window (the turn branch used to steal the next frame).
                m.sprite.play(deathKey);
                const rate = clip.duration > 0 ? clip.duration / BOSS_FALL_MS : 1;
                m.sprite.anims.timeScale = Math.min(1, rate);
                m.fallUntil = m.invulnerableUntil;
            } else if (plan === 'turn') {
                m.sprite.play(turnKey);
                m.turnUntil = m.invulnerableUntil;
            }
            // The HUD plate names the phase; it used to learn about this one a frame later than
            // the body did, because the fall branch returned before the emit.
            EventBus.emit('boss:phase', { id: m.spec.id, phase: upcoming.id });
            return;
        }

        if (m.sprite && this.scene.anims.exists(animKey(m.spec, 'turn'))) {
            m.sprite.play(animKey(m.spec, 'turn'));
            m.turnUntil = m.invulnerableUntil;
        }
        EventBus.emit('boss:phase', { id: m.spec.id, phase: upcoming.id });
    }

    /** Whether a hit may land right now. */
    private isVulnerable(m: Monster, time: number): boolean {
        return time >= m.invulnerableUntil;
    }

    /**
     * One melee swing: the animation, the sound, and the sensor hitbox in front of the
     * body. Shared by ordinary monsters and by the boss, which is why `damage` is a
     * parameter instead of being read from the weapon.
     */
    private performMelee(
        m: Monster,
        dirToPlayer: { x: number; y: number },
        footY: number,
        damage: number,
        rangeOverride?: number,
    ): void {
        const weapon = m.weapon;
        m.weaponVisual.triggerSwing();
        const swingSfx = weapon.sfx?.shoot;
        if (swingSfx) EventBus.emit(SFX_EVENT(swingSfx));
        const range = rangeOverride ?? weapon.range;
        const originX = m.body.position.x;
        const originY = m.body.position.y;
        const dx = dirToPlayer.x;
        const dy = dirToPlayer.y;
        const len = Math.hypot(dx, dy);
        const angle = len > 0 ? Math.atan2(dy, dx) : 0;
        spawnMeleeHitbox(this.scene, this.matter, {
            origin: { x: originX, y: originY },
            angle,
            range,
            hitWidth: weapon.hitWidth ?? range,
            hitHeight: weapon.hitHeight ?? range,
            damage,
            texture: weapon.bullet?.texture,
            scale: weapon.bullet?.scale ?? 0.2,
            rotationOffset: weapon.bullet?.rotationOffset,
            swingAngle: weapon.visual?.swingAngle,
            category: CAT.MONSTER_PROJECTILE,
            mask: PROJECTILE_MONSTER_MASK,
            label: 'monster-melee',
            // Stack the swing in front of the monster's sprite
            // (sprite < bullet < weapon, mirroring the player's
            // CHARACTER < BULLET < WEAPON depth stack). The +10
            // offset matches DEPTH.BULLET - DEPTH.CHARACTER for
            // the flat layer so a melee arc never draws over its
            // owner's body but always draws under the weapon.
            depth: footY + 10,
        });
    }

    /**
     * Pick and run one boss attack.
     *
     * Melee is positional rather than random: if the player is inside the swing she
     * swings, because a god who backs off to shoot while you hug her reads as broken.
     * Everything else comes from the phase's pool with the anti-repeat rules applied.
     */

    /**
     * 剩余怪物数, published for the HUD.
     *
     * Counted from the same list the loop above just walked, plus anything still waiting in
     * `advancePendingSpawns` - a wave that is queued but not placed yet still belongs to the
     * map, and printing 0 for two seconds while nine monsters materialise reads as a bug.
     * Only changes are emitted.
     */
    /**
     * Move the boss to a world position, body and all.
     *
     * Used by the arena walk: she is ONE entity across all five phases, so "she appears in the
     * middle of the star sea" is a teleport of the same monster, not a new spawn. Any queued
     * path is dropped so she does not walk back to where she was.
     */
    moveBoss(x: number, y: number): void {
        const boss = this.monsters.find((m) => m.spec.boss && !m.dead);
        if (!boss) return;
        this.matter.Body.setPosition(boss.body, { x, y });
        this.matter.Body.setVelocity(boss.body, { x: 0, y: 0 });
        boss.path = null;
        boss.currentWaypointIdx = 0;
        boss.shadow?.setPosition(x, y);
    }

    /** Every monster still worth walking to, for the last-monster pointer. */
    remainingPositions(): { x: number; y: number; dead?: boolean; state?: string }[] {
        return this.monsters.map((m) => ({
            x: m.body.position.x,
            y: m.body.position.y,
            dead: m.dead,
            state: m.state,
        }));
    }

    private publishRemaining(): void {
        const pending = Math.max(0, this.pendingSpawns?.length ?? 0);
        const count = remainingWithPending(remainingCount(this.monsters), pending);
        if (count === this.lastRemaining) return;
        this.lastRemaining = count;
        EventBus.emit(MONSTERS_REMAINING_EVENT, { count });
    }

    /** Total boss attacks fired this scene; shown in `?bossDebug=1`. */
    private bossShots = 0;

    /** The crescent of her melee swing, drawn where the hitbox lands. */
    private bossSwingArc(m: Monster, dirToPlayer: { x: number; y: number }): void {
        const reach = BOSS_MELEE_REACH;
        const g = this.scene.add.graphics({ x: m.body.position.x, y: m.body.position.y });
        g.setDepth(1_000_000);
        g.lineStyle(10, 0xfde68a, 0.95);
        g.beginPath();
        g.arc(0, 0, reach * 0.85, Math.PI / 3, -Math.PI / 3, false);
        g.strokePath();
        g.setRotation(Math.atan2(dirToPlayer.y, dirToPlayer.x));
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 260,
            onComplete: () => g.destroy(),
        });
    }

    /** A short bright ring at the boss, so an attack is visible even if its bullet is not. */
    private muzzleFlash(m: Monster): void {
        const flash = this.scene.add.circle(
            m.body.position.x,
            m.body.position.y,
            36,
            0xfbbf24,
            0.9,
        );
        // Pinned far above the floor: at `footY + 20` it was competing with the pavement tiles
        // of the ruins, and the owner saw no flash at all.
        flash.setDepth(1_000_000);
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 420,
            onComplete: () => flash.destroy(),
        });
    }

    private performBossAttack(
        m: Monster,
        dirToPlayer: { x: number; y: number },
        footY: number,
        forced?: {
            attack: 'triple-cannon' | 'barrage' | 'wrath' | 'triple-wrath';
            damageScale?: number;
        },
    ): void {
        const phase = this.phaseOf(m);
        // A REAL distance. `dirToPlayer` is a unit vector, and taking its length made every
        // attack melee: `lastAttack=melee` at `dist=663`, so she swung into open air forever.
        const playerPos = this.playerBody
            ? { x: this.playerBody.position.x, y: this.playerBody.position.y }
            : { x: m.body.position.x + dirToPlayer.x, y: m.body.position.y + dirToPlayer.y };
        const distance = Math.hypot(
            playerPos.x - m.body.position.x,
            playerPos.y - m.body.position.y,
        );
        const meleeReach = BOSS_MELEE_REACH;

        const ctx = {
            scene: this.scene,
            matter: this.matter,
            actor: {
                x: m.body.position.x,
                y: m.body.position.y,
                projectile: m.weapon.projectile
                    ? {
                          speed: m.weapon.projectile.speed,
                          radius: m.weapon.projectile.visual?.radius ?? 9,
                          width: m.weapon.projectile.visual?.width ?? 18,
                          height: m.weapon.projectile.visual?.height ?? 18,
                          color: m.weapon.projectile.visual?.color,
                          texture: m.weapon.bullet?.texture,
                          scale: m.weapon.bullet?.scale,
                      }
                    : undefined,
            },
            aim: Math.atan2(dirToPlayer.y, dirToPlayer.x),
            damageScale: forced?.damageScale ?? phase.damageScale,
            // 阶段 3/4 的炮弹飞双倍远（主人 2026-11-16）。
            bulletLifeScale: phase.bulletLifeScale ?? 1,
            wrathWaves: m.wrathWaves,
            player: playerPos,
            trackBullet: (record: BulletRecord) => {
                // Same list the ordinary monster shots use: it owns the per-frame sprite sync
                // and the expiry sweep. Dropping the record is what froze her shells in place.
                this.projectiles.push({ ...record, monster: m, fireFootY: footY });
            },
            damageAt: (x: number, y: number, radius: number, damage: number) => {
                const body = this.playerBody;
                if (!body) return;
                // Generous by the player's own radius, so a circle that LOOKS like a
                // hit really is one.
                if (Math.hypot(body.position.x - x, body.position.y - y) <= radius + 16) {
                    this.cb.onPlayerHit(damage);
                }
            },
        };

        // 守关 boss：只会这一招，不近战、不连招。主人：`只有这一种攻击方式`。
        if (forced) {
            this.muzzleFlash(m);
            // 亚特兰蒂斯守关（Wanderer）：三连击 + 天谴轰炸。主人 2026-11-12。
            if (forced.attack === 'triple-wrath') {
                const volley = () => {
                    this.muzzleFlash(m);
                    fireCannon(ctx);
                };
                volley();
                this.scene.time.delayedCall(140, volley);
                this.scene.time.delayedCall(280, volley);
                this.scene.time.delayedCall(430, () => {
                    m.wrathWaves += 1;
                    castWrath(ctx, WRATH_CIRCLES);
                });
                return;
            }
            if (forced.attack === 'barrage') {
                fireBarrage(ctx);
            } else if (forced.attack === 'wrath') {
                m.wrathWaves += 1;
                castWrath(ctx, WRATH_CIRCLES);
            } else {
                fireCannon(ctx);
            }
            return;
        }

        m.bossRounds += 1;

        if (isBossMeleeRange(distance, meleeReach)) {
            m.lastBossAttack = 'melee';
            // Her weapon is a mortar, so a swing has no arc art of its own - the owner saw
            // nothing at all when she was toe to toe (`没有正常人物的近战动画`). Draw the
            // reach as a bright crescent for the length of the swing.
            this.bossSwingArc(m, dirToPlayer);
            this.performMelee(
                m,
                dirToPlayer,
                footY,
                BOSS_ATTACKS.melee.damage * phase.damageScale,
                BOSS_MELEE_REACH,
            );
            // Melee is a primary move too: 近战攻击 + 天谴轰炸.
            if (wrathDue(m.bossRounds)) this.queueBossWrath(m, ctx);
            return;
        }

        const kind = pickNextAttack(phase, m.lastBossAttack, Math.random);
        m.lastBossAttack = kind;
        // A shot the player can SEE. The debug panel already says she fires, so if a projectile
        // ever fails to appear the flash still proves the code path ran - and it costs nothing
        // when everything works.
        this.bossShots += 1;
        this.muzzleFlash(m);

        if (kind === 'barrage') {
            fireBarrage(ctx);
        } else {
            fireCannon(ctx);
        }

        // `primary + 天谴轰炸`, on every second round since 2026-11-14 (`把cd时间增加一倍`):
        // the wrath still lands a heartbeat after its primary, but the player now gets a free
        // round in between to move.
        if (wrathDue(m.bossRounds)) this.queueBossWrath(m, ctx);
    }

    /**
     * Fire 天谴轰炸 a beat after the primary attack.
     *
     * Delayed rather than immediate so the two moves read as a combo instead of one wall of
     * circles. Skipped when she has died or the scene is gone in the meantime.
     */
    private queueBossWrath(m: Monster, ctx: BossAttackContext): void {
        this.scene.time.delayedCall(WRATH_PAIR_DELAY_MS, () => {
            if (!m.body || m.hp <= 0) return;
            m.wrathWaves += 1;
            const atHalf = m.hp <= m.phaseMaxHp * 0.5;
            castWrath(ctx, atHalf ? WRATH_CIRCLES_LOW_HP : WRATH_CIRCLES);
        });
    }

    private performAttack(m: Monster, dirToPlayer: { x: number; y: number }, footY: number): void {
        if (m.spec.bossAttack) {
            // 半神阶段的伤害倍率就是守关 boss 的基准（主人：`伤害复用半神Claude的伤害`）。
            this.performBossAttack(m, dirToPlayer, footY, {
                attack: m.spec.bossAttack,
                damageScale: m.spec.bossAttackDamageScale ?? DEMIGOD_DAMAGE_SCALE,
            });
            return;
        }
        if (m.spec.boss) {
            this.performBossAttack(m, dirToPlayer, footY);
            return;
        }

        const weapon = m.weapon;
        const projectile = weapon.projectile;
        const isMelee = projectile === undefined;

        // Melee: trigger the swing tween (same animation the player gets)
        // AND spawn a sensor hitbox so the swing has a proper hit-zone that
        // matches player melee behaviour (slash arc + sensor body in front
        // of the monster). Contact damage on the body itself is also kept
        // as a fallback for the rare case where the player walks into the
        // monster between swings.
        if (isMelee) {
            this.performMelee(m, dirToPlayer, footY, this.phaseDamage(m, weapon.damage));
            return;
        }

        // Ranged: trigger recoil, spawn projectile from the weapon's muzzle.
        // Don't lead — player dodge makes reaction aim more rewarding than prediction.
        const len = Math.hypot(dirToPlayer.x, dirToPlayer.y);
        if (len === 0) return;
        const { speed, visual: size } = projectile;
        const muzzlePos = m.weaponVisual.getMuzzlePosition(m.body.position.x, m.body.position.y);
        m.weaponVisual.triggerRecoil();
        EventBus.emit(SFX_EVENT(weapon.sfx?.shoot ?? 'monster-shoot'));
        const bullet = spawnProjectile(
            this.scene,
            this.matter,
            { x: muzzlePos.x, y: muzzlePos.y },
            { x: dirToPlayer.x, y: dirToPlayer.y },
            {
                label: 'monster-projectile',
                category: CAT.MONSTER_PROJECTILE,
                mask: PROJECTILE_MONSTER_MASK,
                speed,
                damage: this.phaseDamage(m, weapon.damage),
                size,
                // Render bullet as a sprite when the weapon spec has one —
                // matches how player bullets look (e.g. assault-bullet.png).
                texture: weapon.bullet?.texture,
                scale: weapon.bullet?.scale,
                anchor: weapon.bullet?.anchor,
                rotationOffset: weapon.bullet?.rotationOffset,
                // Hard cap on lifetime — per-weapon override or default
                // (1500ms) applied in spawnProjectile. Prevents missed
                // shots from lingering ~4-10s on screen while Matter
                // friction decays speed below the cleanup threshold.
                lifeMs: weapon.projectile?.lifeMs,
                // Stack the bullet in front of the monster's sprite.
                // The +10 offset matches DEPTH.BULLET - DEPTH.CHARACTER
                // on the flat layer, so the per-frame sync can keep
                // `bullet depth = owner footY + 10` and preserve the
                // sprite < bullet < weapon ordering as the monster
                // moves.
                depth: footY + 10,
            },
        );
        this.projectiles.push({ ...bullet, monster: m, fireFootY: footY });
    }

    private kill(m: Monster): void {
        m.state = 'dying';
        EventBus.emit(SFX_EVENT(m.spec.sfx?.death ?? 'monster-death'));
        this.updateWaveProgressSave();

        // Bounty — the level's profit. Paid here because `kill()` is the
        // single choke point every damage path funnels through, so each
        // monster pays out exactly once.
        useGameStore.getState().addMoney(m.spec.money);

        // Hide the held weapon during the death animation so it doesn't
        // float in mid-air beside the corpse.
        m.weaponVisual?.setHitFlash(false);
        m.weaponVisual?.setVisible(false);
        if (m.sprite) {
            m.sprite.clearTint();
            (m.sprite as any).setTintMode?.(0);
        }

        // Disable collision filter so dead monster doesn't block player or bullets
        m.body.collisionFilter.mask = 0;

        // Compute the death-track duration so the fade can run in PARALLEL
        // with the animation, not after. By the time the death anim ends
        // the body is already partly transparent; the tail of the tween
        // finishes the dissolve to 0.
        const deathTrackKey = animKey(m.spec, 'death');
        const hasDeathAnim = !!(m.sprite && this.scene.anims.exists(deathTrackKey));
        if (hasDeathAnim && m.sprite) {
            m.sprite.play(deathTrackKey);
        }
        const animMs = hasDeathAnim ? (this.scene.anims.get(deathTrackKey)?.duration ?? 0) : 0;
        this.startDeathFade(m, animMs);
    }

    /**
     * Tween alpha to 0 over `animMs + MONSTER_DEATH_FADE_MS`, then
     * destroy. The fade runs in parallel with the death animation, so
     * the body starts dissolving the moment the monster dies.
     *
     * onMonsterDied fires at the end of the death animation (so the
     * dropped items appear at the moment the body is half-faded — the
     * "puff of smoke + loot materialises" beat). If there's no death
     * animation, the callback fires immediately and the total fade
     * duration collapses to MONSTER_DEATH_FADE_MS.
     */
    private startDeathFade(m: Monster, animMs: number): void {
        const totalMs = animMs + MONSTER_DEATH_FADE_MS;
        const dropSpawnAt = animMs; // emit onMonsterDied at end of death anim

        if (animMs > 0) {
            this.scene.time.delayedCall(dropSpawnAt, () => this.cb.onMonsterDied(m));
        } else {
            // No death animation — drop loot immediately, fade as the
            // only visible cue.
            this.cb.onMonsterDied(m);
        }

        // Capture the targets now — destroy() will null out the
        // references and a tween against the same handle would no-op.
        // All four GameObject subclasses (Sprite / Ellipse / Rectangle)
        // share the single `alpha: number` property, which is what the
        // tween actually mutates.
        const targets: Phaser.GameObjects.GameObject[] = [];
        if (m.sprite) targets.push(m.sprite);
        if (m.shadow) targets.push(m.shadow);
        if (m.debugBodyRect) targets.push(m.debugBodyRect);
        if (m.debugHitboxRect) targets.push(m.debugHitboxRect);
        if (targets.length === 0) {
            m.destroy(this.scene);
            return;
        }

        this.scene.tweens.add({
            targets,
            alpha: 0,
            duration: totalMs,
            ease: 'Linear',
            onComplete: () => m.destroy(this.scene),
        });
    }

    /**
     * Per-frame: advance the trigger-gated spawn queue. Builds an
     * alive snapshot grouped by waveId, hands it to the pure reducer,
     * instantiates any spawns that fire, and updates the surviving
     * queue with refreshed `clearReadyAt` stamps.
     */
    private advancePendingSpawns(time: number): void {
        if (this.pendingSpawns.length === 0) return;

        // Build alive snapshot: count non-dead/non-dying monsters per waveId.
        // Empty-string bucket holds spawns without a waveId.
        const byWave: Record<string, number> = {};
        for (const m of this.monsters) {
            if (m.dead || m.state === 'dying') continue;
            const w = m.waveId ?? '';
            byWave[w] = (byWave[w] ?? 0) + 1;
        }
        const alive: AliveSnapshot = { byWave };

        const pendingList = this.pendingSpawns.map((q) => q.pending);
        const { fired, remaining } = advanceSpawnQueue(pendingList, time, alive);

        // Instantiate fired spawns + keep survivors with updated clearReadyAt.
        const remainingByIndex = new Map<number, PendingSpawn>();
        for (const p of remaining) remainingByIndex.set(p.index, p);
        this.pendingSpawns = this.pendingSpawns.filter((q) => {
            const isFired = fired.some((p) => p.index === q.pending.index);
            if (isFired) {
                this.monsters.push(
                    new Monster(
                        this.scene,
                        q.spec,
                        q.weapon,
                        q.pending.x,
                        q.pending.y,
                        q.pending.waveId,
                    ),
                );
                return false;
            }
            const refreshed = remainingByIndex.get(q.pending.index);
            // Mirror back every field the queue may have updated. The
            // queue returns fresh spread copies; without this both
            // clearReadyAt AND hasSeenAlive stay frozen on the original
            // pending object, which breaks clear-trigger gating
            // (hasSeenAlive never flips → clear spawns never fire).
            if (refreshed) {
                q.pending.clearReadyAt = refreshed.clearReadyAt;
                q.pending.hasSeenAlive = refreshed.hasSeenAlive;
            }
            return true;
        });

        this.updateWaveProgressSave();
    }

    private updateWaveProgressSave(): void {
        const levelId = (this.scene as any).id;
        if (!levelId) return;

        // Active waves still alive or pending
        const activeWaveIds = new Set<string>();
        for (const m of this.monsters) {
            if (!m.dead && m.state !== 'dying' && m.waveId) {
                activeWaveIds.add(m.waveId);
            }
        }
        for (const p of this.pendingSpawns) {
            if (p.pending.waveId) {
                activeWaveIds.add(p.pending.waveId);
            }
        }

        const existing = useGameStore.getState().levelProgressMap[levelId];
        const cleared = new Set<string>(existing?.clearedWaveIds ?? []);
        let changed = false;

        // Check if any wave previously spawned has now completely cleared
        for (const m of this.monsters) {
            if (m.waveId && !activeWaveIds.has(m.waveId) && !cleared.has(m.waveId)) {
                cleared.add(m.waveId);
                changed = true;
            }
        }

        if (changed) {
            const clearedList = Array.from(cleared);
            useGameStore.getState().setWaveProgress(levelId, {
                clearedWaveIds: clearedList,
                currentWaveIndex: clearedList.length,
            });
        }
    }

    private bindCollisions(): void {
        this.scene.matter.world.on('collisionstart', (event: any) => {
            const pairs = event.pairs || [];
            for (const pair of pairs) {
                const a = pair.bodyA;
                const b = pair.bodyB;
                if (!a || !b) continue;

                // ── monster-projectile ↔ player / wall ──────────────────
                const projBody =
                    a.label === 'monster-projectile'
                        ? a
                        : b.label === 'monster-projectile'
                          ? b
                          : null;
                if (projBody) {
                    const other = projBody === a ? b : a;
                    if (other === this.playerBody) {
                        this.damagePlayerFromProjectile(projBody as MatterJS.BodyType);
                    } else if (typeof other.label === 'string' && other.label.startsWith('wall:')) {
                        // Tall wall collision — short walls don't appear
                        // here because the projectile mask omits WALL_SHORT.
                        this.destroyProjectileByBody(projBody as MatterJS.BodyType);
                    }
                    continue;
                }

                // ── monster-melee (swing hitbox) ↔ player ───────────────
                // Mirrors player plasma-sword: a sensor body fires briefly
                // in front of the monster; on overlap it damages the player.
                const meleeBody =
                    a.label === 'monster-melee' ? a : b.label === 'monster-melee' ? b : null;
                if (meleeBody) {
                    const other = meleeBody === a ? b : a;
                    if (other === this.playerBody) {
                        this.damagePlayerFromMelee(meleeBody as MatterJS.BodyType);
                    }
                    continue;
                }

                // ── monster (melee body) ↔ player ─────────────────────
                if (
                    (a.label === 'monster' && b === this.playerBody) ||
                    (b.label === 'monster' && a === this.playerBody)
                ) {
                    this.damagePlayerFromContact();
                    continue;
                }

                // ── monster ↔ wall (instant escape) ────────────────────
                // The 60 ms stuck detector is too slow to react to a wall
                // bounce — by the time it fires, the LERP has already
                // blended the bounce-back into the velocity vector and
                // the monster keeps oscillating against the wall. Matter
                // tells us the collision happened THIS frame, so we
                // override the velocity here: aim along the path's next
                // segment, or perpendicular to the wall normal if no
                // path is available. The wallEscapeUntil window
                // prevents the per-frame loop from undoing the
                // override before the monster clears the wall cell.
                const monsterBody = a.label === 'monster' ? a : b.label === 'monster' ? b : null;
                const wallBody =
                    monsterBody && typeof a.label === 'string' && a.label.startsWith('wall:')
                        ? a
                        : monsterBody && typeof b.label === 'string' && b.label.startsWith('wall:')
                          ? b
                          : null;
                if (monsterBody && wallBody) {
                    const monster = this.monsters.find((mm) => mm.body === monsterBody && !mm.dead);
                    if (monster && this.scene.time.now >= monster.wallEscapeUntil) {
                        this.applyWallEscape(monster, wallBody);
                        // Suppress further wall escapes for 150 ms —
                        // gives the monster a chance to actually move
                        // away from the wall before re-evaluating.
                        monster.wallEscapeUntil = this.scene.time.now + 150;
                    }
                    continue;
                }
            }
        });
    }

    private destroyProjectileByBody(body: MatterJS.BodyType): void {
        const proj = this.projectiles.find((p) => p.body === body);
        if (!proj) return;
        this.destroyProjectile(proj);
    }

    /**
     * Matter collisionstart fired: the monster just bumped a wall.
     * Override its velocity along the path's next segment so it
     * actually slides past the wall instead of bouncing back into
     * it. Per-frame loop respects wallEscapeUntil so this direction
     * sticks for a few frames.
     *
     * Wall normal is the unit vector pointing FROM the wall body TO
     * the monster (Matter convention). The escape direction is the
     * tangent along the path; if the path is unavailable, we push
     * perpendicular to the wall normal as a safe default.
     */
    private applyWallEscape(monster: Monster, wallBody: MatterJS.BodyType): void {
        const mp = monster.body.position;
        const wp = wallBody.position;
        // Wall normal: from wall to monster.
        const nx = mp.x - wp.x;
        const ny = mp.y - wp.y;
        const nlen = Math.hypot(nx, ny);
        let escapeX: number;
        let escapeY: number;

        // Decide whether to slide ALONG the wall (perpendicular to
        // the normal) or aim at the next waypoint. In a tight corner
        // the next waypoint also sits against the same wall family —
        // aiming at it just drives the monster deeper into the wall.
        // isPositionInCorner reads the grid (cellSize + buffer) so the
        // detection matches the pathfinder's notion of "tight".
        const nextWp =
            monster.path && monster.currentWaypointIdx + 1 < monster.path.length
                ? monster.path[monster.currentWaypointIdx + 1]
                : null;
        const waypointAlsoInCorner = nextWp
            ? (this.pathfinder?.isPositionInCorner(nextWp) ?? false)
            : true;

        if (nextWp && !waypointAlsoInCorner) {
            // Open path ahead — aim at the next waypoint so the
            // monster resumes chasing along the path.
            escapeX = nextWp.x - mp.x;
            escapeY = nextWp.y - mp.y;
            const len = Math.hypot(escapeX, escapeY);
            if (len === 0) {
                escapeX = 0;
                escapeY = 0;
            } else {
                escapeX /= len;
                escapeY /= len;
            }
        } else if (nlen > 0) {
            // Cornered: slide perpendicular to the wall normal so the
            // body peels off the wall and curves around the corner.
            escapeX = -ny / nlen;
            escapeY = nx / nlen;
            // Pick the perpendicular that points away from the wall
            // (i.e. has a positive component along the wall normal).
            const dot = escapeX * (nx / nlen) + escapeY * (ny / nlen);
            if (dot < 0) {
                escapeX = -escapeX;
                escapeY = -escapeY;
            }
        } else {
            escapeX = 0;
            escapeY = 0;
        }
        const escapeSpeed = this.phaseSpeed(monster) * 1.5;
        this.matter.Body.setVelocity(monster.body, {
            x: escapeX * escapeSpeed,
            y: escapeY * escapeSpeed,
        });
    }

    private damagePlayerFromProjectile(projBody: MatterJS.BodyType): void {
        const proj = this.projectiles.find((p) => p.body === projBody);
        if (!proj) return;
        const now = this.scene.time.now;
        // ponytail: contact damage respects a short cooldown so brush-by
        // contact doesn't stack to death in 1 frame. Projectiles themselves
        // always destroy on contact.
        if (now - this.lastDamageAt < COMBAT_PLAYER_DAMAGE_COOLDOWN_MS) {
            this.destroyProjectile(proj);
            return;
        }
        EventBus.emit(SFX_EVENT('player-hit'));
        this.cb.onPlayerHit(proj.damage);
        this.lastDamageAt = now;
        this.destroyProjectile(proj);
    }

    /**
     * Apply damage to the player from a monster melee swing hitbox. The body
     * self-destroys via the spawnMeleeHitbox tween (no projectile cleanup
     * needed). Like projectile hits, contact damage respects the global
     * cooldown so simultaneous melee overlaps don't double-tap.
     */
    private damagePlayerFromMelee(meleeBody: MatterJS.BodyType): void {
        const now = this.scene.time.now;
        if (now - this.lastDamageAt < COMBAT_PLAYER_DAMAGE_COOLDOWN_MS) return;
        // Find the swinging monster — the swing body was spawned from the
        // attacker's position, so pick the nearest melee monster.
        const meleeMonsters = this.monsters.filter(
            (m) => !m.dead && m.weapon.projectile === undefined,
        );
        const best = pickClosestMonster(meleeBody.position, meleeMonsters, Infinity);
        if (!best) return;
        EventBus.emit(SFX_EVENT('player-hit'));
        this.cb.onPlayerHit(best.weapon.damage);
        this.lastDamageAt = now;
    }

    private damagePlayerFromContact(): void {
        const now = this.scene.time.now;
        if (now - this.lastDamageAt < COMBAT_PLAYER_DAMAGE_COOLDOWN_MS) return;
        // Find which melee monster is overlapping the player; pick nearest.
        const meleeMonsters = this.monsters.filter(
            (m) => !m.dead && m.weapon.projectile === undefined,
        );
        const best = pickClosestMonster(this.playerBody.position, meleeMonsters, Infinity);
        if (!best) return;
        EventBus.emit(SFX_EVENT('player-hit'));
        this.cb.onPlayerHit(best.weapon.damage);
        this.lastDamageAt = now;
    }

    private destroyProjectile(proj: MonsterProjectile): void {
        const idx = this.projectiles.indexOf(proj);
        if (idx >= 0) this.projectiles.splice(idx, 1);
        this.scene.matter.world.remove(proj.body);
        proj.rect.destroy();
    }
}
