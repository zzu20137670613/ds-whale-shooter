/**
 * src/game/characters/logic.ts
 * --------------------------------------------------------------------------
 * Player behavior. Two layers:
 *
 *   1. Pure helpers (moveIntent / dodgeIntent / clampToBounds) — no
 *      runtime dependencies, safe to import from Node tests.
 *
 *   2. CharacterController class — owns the per-frame tick, keyboard /
 *      pointer binding, and mutable state. Its constructor self-registers
 *      with `scene.events.on('update', ...)`. Uses `import type` for
 *      Phaser (types only) and hardcoded keycodes so this file has zero
 *      runtime Phaser dependency — keeps Node tests clean and the module
 *      trivially tree-shakeable.
 *
 * Phaser v4 compat: scene.events is a Phaser.Events.EventEmitter with
 * standard on/off (verified from phaser/types/phaser.d.ts).
 */

import type * as Phaser from 'phaser';

import { pickText } from '@/locales';

import {
    absorbIncomingHit,
    attackMultiplier,
    emptySkillRuntime,
    skillSpCost,
    useSkill,
} from '@/lib/characters/skill';
import { handUpOffset, pickBodyTint } from '@/lib/characters/hand';
import { needsAnimPlay } from '@/lib/characters/anim-state';
import { idlePoseFor } from '@/lib/characters/idle-pose';
import { damageAfterArmor } from '@/lib/characters/combat';
import {
    facingFromMotion,
    facingFromSpawn,
    flipXForFacing,
    type Facing,
} from '@/lib/characters/facing';
import { WHALE_BLESSING, blessingApplies } from '@/lib/pet/bonus';
import { scaledSkillCooldown, scaledSkillSpCost } from '@/lib/characters/skill-scaling';
import { aimFromIntent, aimPointFrom } from '@/lib/input/aim';
import { SHOP_RESTORE_VITALS_EVENT } from '@/lib/characters/vitals';
import {
    AIM_DIRECTIONAL_RANGE,
    CHARACTER_HURT_FLASH_MS,
    CHARACTER_SPRINT_MULTIPLIER,
    HEADGEAR_DEFAULT_TINT,
    KEY_A,
    KEY_D,
    KEY_E,
    KEY_FIVE,
    KEY_FOUR,
    KEY_ONE,
    KEY_R,
    KEY_F,
    KEY_Q,
    KEY_S,
    KEY_SEVEN,
    KEY_SHIFT,
    KEY_SIX,
    KEY_SPACE,
    KEY_RIGHT,
    KEY_LEFT,
    KEY_DOWN,
    KEY_UP,
    KEY_K,
    KEY_J,
    KEY_THREE,
    KEY_TWO,
    KEY_W,
    SFX_EVENT,
    WEAPONS_REFILL_ONE_EVENT,
} from '@/lib/constants';
import { getCheats } from '@/lib/dev/cheats';
import { EventBus } from '@/lib/events/bus';
import { maxWeaponUpgradeLevel } from '@/lib/weapons/upgrades';
import { appRect, toAppPoint } from '@/lib/mobile';
import type { CharacterSpec } from '@/lib/characters';
import type { Level } from '@/lib/levels/types';
import { useGameStore } from '@/store/game-store';

import { animKey } from './keys';

/** Dev cheat HP cap — effectively "cannot die". */
const INFINITE_HP_VALUE = 999_999_999;

// ─── Pure helpers ────────────────────────────────────────────────────────

export interface MoveIntent {
    vx: number;
    vy: number;
}

/** Normalised WASD vector. Returns zero when no direction is pressed. */
export function moveIntent(keys: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}): MoveIntent {
    let vx = 0;
    let vy = 0;
    if (keys.up) vy -= 1;
    if (keys.down) vy += 1;
    if (keys.left) vx -= 1;
    if (keys.right) vx += 1;
    const len = Math.hypot(vx, vy);
    if (len === 0) return { vx: 0, vy: 0 };
    return { vx: vx / len, vy: vy / len };
}

/** Locomotion state for a frame: standing, walking, or sprinting. */
export type Locomotion = 'idle' | 'walk' | 'run';

/**
 * Which visual scale multiplier applies to a spawned character.
 *
 * A multiplier of 1 is the rule — sheets are authored at the scale their
 * level's art implies. A scene may pass one (`LoadCharacterOptions.
 * spriteScaleMultiplier`) when its background is drawn at a different
 * architectural scale; the tavern does, because a deck plank there is
 * ~50px wide, which implies a human several times taller than the
 * sheets. Zero or negative would make the character invisible or
 * mirrored, so those fall back to 1 rather than being obeyed.
 *
 * VISUAL ONLY, and deliberately separate from the physics: the body and
 * the hitbox sensor must stay on `spec.sprite.scale` (the compound
 * body's position is the average of its parts, so a bigger sensor would
 * move the character).
 */
export function resolveActorScaleMultiplier(multiplier: number | undefined): number {
    return multiplier !== undefined && multiplier > 0 ? multiplier : 1;
}

/**
 * Which locomotion state this frame is in: `idle` when standing still (sprint
 * key or not), `run` while moving with the sprint key held, `walk` otherwise.
 * Pure, so the choice is testable without a scene.
 */
export function resolveLocomotion(isMoving: boolean, isSprinting: boolean): Locomotion {
    if (!isMoving) return 'idle';
    return isSprinting ? 'run' : 'walk';
}

/**
 * Movement speed for a frame: the spec's own `moveSpeed`, boosted while
 * sprinting. Pure, so the arithmetic is testable without a physics body.
 */
export function resolveMoveSpeed(baseSpeed: number, isSprinting: boolean): number {
    return isSprinting ? baseSpeed * CHARACTER_SPRINT_MULTIPLIER : baseSpeed;
}

export interface DodgeIntent {
    vx: number;
    vy: number;
}

/**
 * Decide whether a dodge should trigger this frame and return its velocity.
 * Returns null when no dodge should fire.
 */
export function dodgeIntent(
    spaceDown: boolean,
    intent: MoveIntent,
    sp: number,
    spCost: number,
    cooldownMs: number,
    lastDodgeEndAt: number,
    dodgeActiveUntil: number,
    dodgeSpeed: number,
    now: number,
): DodgeIntent | null {
    const canDodge = sp >= spCost && now - lastDodgeEndAt >= cooldownMs && now >= dodgeActiveUntil;
    const hasDirection = intent.vx !== 0 || intent.vy !== 0;
    if (!spaceDown || !hasDirection || !canDodge) return null;
    return {
        vx: intent.vx * dodgeSpeed,
        vy: intent.vy * dodgeSpeed,
    };
}

/**
 * Pick the SFX id for a "player got hit" event. Pure helper so tests
 * can verify the gender routing without booting a Phaser scene.
 *
 * Lookup order:
 *   1. gender === 'female'  →  sfx.hurtFemale
 *   2. gender === 'male'    →  sfx.hurtMale
 *   3. fallback             →  sfx.hurt (legacy / gender-neutral)
 *
 * Returns null when nothing is configured (caller skips the SFX emit).
 */
export function resolveHurtSfx(spec: {
    gender?: 'male' | 'female';
    sfx?: {
        hurt?: string;
        hurtMale?: string;
        hurtFemale?: string;
    };
}): string | null {
    const sfx = spec.sfx;
    if (!sfx) return null;
    if (spec.gender === 'female') return sfx.hurtFemale ?? sfx.hurt ?? null;
    if (spec.gender === 'male') return sfx.hurtMale ?? sfx.hurt ?? null;
    return sfx.hurt ?? null;
}

/** Clamp `pos` to the world rectangle. Returns null when already inside. */
export function clampToBounds(
    pos: { x: number; y: number },
    halfW: number,
    halfH: number,
    worldW: number,
    worldH: number,
): { x: number; y: number } | null {
    const maxX = worldW - halfW;
    const maxY = worldH - halfH;
    if (pos.x >= halfW && pos.x <= maxX && pos.y >= halfH && pos.y <= maxY) {
        return null;
    }
    return {
        x: Math.max(halfW, Math.min(maxX, pos.x)),
        y: Math.max(halfH, Math.min(maxY, pos.y)),
    };
}

/**
 * Pick the nearest monster to (originX, originY) by Euclidean distance.
 * Pure so the controller and tests can share the auto-aim math without
 * booting a Phaser scene. Returns null when the list is empty.
 */
export function pickNearestMonster<T extends { x: number; y: number }>(
    monsters: readonly T[],
    originX: number,
    originY: number,
): T | null {
    if (monsters.length === 0) return null;
    let nearest: T = monsters[0];
    let minDist = Math.hypot(monsters[0].x - originX, monsters[0].y - originY);
    for (let i = 1; i < monsters.length; i++) {
        const m = monsters[i];
        const d = Math.hypot(m.x - originX, m.y - originY);
        if (d < minDist) {
            minDist = d;
            nearest = m;
        }
    }
    return nearest;
}

// ─── Controller ──────────────────────────────────────────────────────────

// Body size + dodge params come from CharacterSpec (loaded from YAML).
// Keycodes come from `@/lib/constants` — Phaser's runtime reads browser
// globals at module load and crashes in Node tests, so the player keymap
// lives as plain numbers in shared constants rather than importing
// `Input.Keyboard.KeyCodes`.

/** Structural shape the controller needs from the WeaponSystem. */
export interface WeaponsLike {
    update(
        time: number,
        tx: number,
        ty: number,
        fire: boolean,
        halfH: number,
        footY?: number,
    ): void;
    switchTo(index: number): void;
    cycleSlot(direction: 1 | -1): void;
    manualReload(): void;
    refillActiveAmmo(fraction: number): void;
    swapToWeapon(weaponId: string): boolean;
    /** True when this weapon id already sits in the hotbar. */
    hasWeapon(weaponId: string): boolean;
    getActiveSlotState(): StatusHudState;
    tryPickupWeapon(spec: import('@/lib/weapons').WeaponSpec): 'added' | 'capped';
    replaceSlot(slotIndex: number, spec: import('@/lib/weapons').WeaponSpec): void;
    getMaxSlots(): number;
}

/** Structural shape the controller needs from the character HUD. */
export interface HudLike {
    update(spec: CharacterSpec, hp: number, sp: number): void;
}

/** Structural shape the controller needs from the weapon HUD. */
export interface WeaponHudLike {
    draw(weapons: WeaponsLike, time: number): void;
}

/** Structural shape the controller needs from the floating status HUD
 *  (above the character's head — currently shows reload progress). */
export interface StatusHudLike {
    update(state: StatusHudState, time: number, halfH: number): void;
    showFloatingNumber?(amount: number, type: 'damage' | 'heal' | 'crit'): void;
}

/** Subset of weapon-slot state StatusHud needs. */
export interface StatusHudState {
    name?: string;
    reloading?: boolean;
    reloadStartedAt?: number;
    reloadTimeMs?: number;
    justCompletedAt?: number;
    hp?: number;
    maxHp?: number;
    showHpBar?: boolean;
    sp?: number;
    maxSp?: number;
    showSpBar?: boolean;
    dodgeActive?: boolean;
    dodgeCooldownStartedAt?: number;
    dodgeCooldownTimeMs?: number;
}

/** Everything the controller needs from outside — passed in by load-character. */
export interface CharacterRuntimeParts {
    body: any;
    sprite: Phaser.GameObjects.Sprite;
    shadow?: Phaser.GameObjects.Shape;
    debugBodyRect?: Phaser.GameObjects.Rectangle;
    debugHitboxRect?: Phaser.GameObjects.Rectangle;
    matter: any;
    weapons: WeaponsLike;
    hud: HudLike;
    weaponHud: WeaponHudLike;
    statusHud: StatusHudLike;
}

export class CharacterController {
    private readonly scene: Phaser.Scene;
    private readonly spec: CharacterSpec;
    private readonly parts: CharacterRuntimeParts;

    // Mutable runtime state.
    private hp: number;
    private sp: number;
    private hurtFlashUntil = 0;
    private dodgeActiveUntil = 0;
    private lastDodgeEndAt = 0;
    private lastGhostAt = 0;
    private readonly activeDodgeGhosts: Phaser.GameObjects.Sprite[] = [];
    private dodgeVx = 0;
    private dodgeVy = 0;
    private firing = false;
    // null until the first pointermove — lets the spawn-time flipX hold
    // instead of immediately snapping to wherever the cursor happens to be.
    private targetX: number | null = null;
    private targetY: number | null = null;
    /**
     * Which way she is drawn. Set from the spawn facing and then only changed by
     * walking - see `facingFromMotion`. Aiming never touches it.
     */
    private facing: Facing = 'right';
    /** `?spriteDebug=1` publishes per-frame sprite state for the corner readout. */
    private readonly debugSprite =
        typeof window !== 'undefined' && window.location.search.includes('spriteDebug');
    private dbgFlipCount = 0;
    private dbgAnimCount = 0;
    private dbgFrameCount = 0;
    private dbgLastFlip = false;
    private dbgLastAnim: string | null = null;
    private dbgLastFrame = -1;
    private dbgWindowStart = 0;
    private dbgRates = { flips: 0, anims: 0, frames: 0 };
    /** Last handful of sprite states, oldest first - tells idle flicker from state flapping. */
    private dbgHistory: string[] = [];
    // Mobile touch state — written by EventBus listeners from
    // TouchControls.tsx, merged into the keyboard intent on each tick.
    // null pointer id == joystick not held.
    private mobileMove: { vx: number; vy: number } | null = null;
    private mobileFiring = false;
    private mobileDodge = false;
    /** Last footstep SFX time — throttle to ~5 per second so the loop
     *  doesn't spam when the player holds WASD. */
    private lastFootstepAt = 0;
    /** Throttle for the low-HP heartbeat so it pulses rather than buzzes. */
    private lastHeartbeatAt = 0;
    /** Dev cheat: when true, `heal(hpDelta<0, …)` is a no-op so the
     *  character can't die. Toggled via the cheat panel / EventBus. */
    private infiniteHp = false;
    /** Timestamp of the last SP trickle, so the rate is frame-rate independent. */
    private lastSpRegenAt = 0;
    /** Skill state — see `lib/characters/skill`. One runtime serves every
     *  kind; the controller only reads and writes it through the pure API. */
    private skillRuntime = emptySkillRuntime();
    /** Coarse fingerprint of what the badge last drew — see publishSkillStatus. */
    private lastSkillStatusSignature = '';

    private readonly cleanupFns: Array<() => void> = [];

    constructor(
        scene: Phaser.Scene,
        level: Level,
        spec: CharacterSpec,
        parts: CharacterRuntimeParts,
    ) {
        // Start facing the way the level spawned her; walking takes over from there.
        this.facing = facingFromSpawn(level.characterSpawn?.facing);

        this.scene = scene;
        this.spec = spec;
        this.parts = parts;

        const savedHp = useGameStore.getState().hp;
        const savedSp = useGameStore.getState().sp;
        this.hp = typeof savedHp === 'number' && savedHp > 0 ? Math.min(savedHp, spec.hp) : spec.hp;
        this.sp =
            typeof savedSp === 'number' && savedSp >= 0 ? Math.min(savedSp, spec.sp) : spec.sp;

        // Honor a pre-existing dev "Infinite HP" toggle (e.g. user
        // toggled it, then refreshed the page). The cheat panel only
        // mounts on localhost — same gate as `isDev()` — so this is
        // inert in production.
        if (getCheats().infiniteHp) {
            this.infiniteHp = true;
            this.hp = INFINITE_HP_VALUE;
        }

        // Spawn-time target stays null — the first real pointermove will
        // populate it. Until then, the sprite keeps the flipX that
        // loadCharacter() set from level.characterSpawn.facing.

        this.bindKeyboard();
        this.bindPointer();
        this.bindMobile();

        // Chain the dodge -> idle transition. Bound once in the
        // constructor so we don't leak listeners on every stop event.
        const onAnimDone = () => this.onAnimComplete();
        this.parts.sprite.on('animationcomplete', onAnimDone);
        this.cleanupFns.push(() => this.parts.sprite.off('animationcomplete', onAnimDone));

        const tick = () => this.update(scene.time.now);
        scene.events.on('update', tick);
        this.cleanupFns.push(() => scene.events.off('update', tick));

        // Dev cheat — Infinite HP toggle. Updates the runtime flag and
        // bumps HP to the cap when enabling.
        const infiniteHpHandler = (payload?: { value?: boolean }) => {
            this.infiniteHp = payload?.value === true;
            if (this.infiniteHp) this.hp = INFINITE_HP_VALUE;
        };
        EventBus.on('dev:cheat:infiniteHp', infiniteHpHandler);
        this.cleanupFns.push(() =>
            EventBus.removeListener('dev:cheat:infiniteHp', infiniteHpHandler),
        );

        // The merchant sells a full HP + SP refill. There is no passive regen
        // any more, so this (and pickups) is the only way back up — the panel
        // charges for it and this handler does the actual topping up.
        const restoreVitalsHandler = () => {
            this.heal(this.spec.hp - this.hp, this.spec.sp - this.sp);
        };
        EventBus.on(SHOP_RESTORE_VITALS_EVENT, restoreVitalsHandler);
        this.cleanupFns.push(() =>
            EventBus.removeListener(SHOP_RESTORE_VITALS_EVENT, restoreVitalsHandler),
        );
    }

    // ─── Public API ──────────────────────────────────────────────────────

    /** Damage multiplier for ONE attack. A `critical-next` is spent here, so
     *  firing a shot that misses still uses it up — asked for explicitly. The
     *  weapon controller calls this once per attack, not once per bullet. */
    consumeAttackMultiplier(): number {
        const { mul, runtime } = attackMultiplier(this.skillRuntime, this.scene.time.now);
        this.skillRuntime = runtime;
        return mul;
    }

    /** Apply HP/SP healing (clamped to [0, max]). Negative values damage.
     *  Dev cheat: when `infiniteHp` is on, negative HP deltas are
     *  silently ignored so the player can't die. */
    heal(hpDelta: number, spDelta: number): void {
        // A skill may eat the hit instead of her HP: the headgear's soak, or a
        // divine guest's one free hit. Both count HITS, not HP. The headgear's
        // cooldown starts on the hit that breaks it, not on the press.
        if (hpDelta < 0) {
            const routed = absorbIncomingHit(
                this.spec.skill,
                this.skillRuntime,
                this.scene.time.now,
                -hpDelta,
                this.skillCooldownMs(),
            );
            this.skillRuntime = routed.runtime;
            if (routed.brokeHeadgear || routed.brokeShield) {
                this.parts.sprite.clearTint();
                (this.parts.sprite as any).setTintMode?.(0);
                EventBus.emit('combat:headgear-broke', {});
            }
            // A ward that soaked the whole hit ends here; a nine-lives shield that
            // broke lets the remainder through, so a big attack is not free.
            if (Number.isFinite(routed.remainingDamage)) {
                hpDelta = -routed.remainingDamage;
                if (hpDelta >= 0) return;
            } else if (routed.absorbed) {
                return;
            }
        }
        const hpBlocked = this.infiniteHp && hpDelta < 0;
        if (hpDelta !== 0 && !hpBlocked) {
            const oldHp = this.hp;
            this.hp = Math.max(0, Math.min(this.spec.hp, this.hp + hpDelta));
            const actualDelta = this.hp - oldHp;
            if (oldHp > 0 && this.hp === 0 && !hpBlocked) {
                this.handleDeath();
            }
            if (actualDelta !== 0 && this.parts.statusHud?.showFloatingNumber) {
                this.parts.statusHud.showFloatingNumber(
                    actualDelta,
                    actualDelta > 0 ? 'heal' : 'damage',
                );
            }
            if (hpDelta < 0) {
                this.hurtFlashUntil = this.scene.time.now + CHARACTER_HURT_FLASH_MS;
                this.parts.sprite.setTint(0x992222);
                (this.parts.sprite as any).setTintMode?.(2);
                EventBus.emit('combat:player-hurt', { damage: -actualDelta });
                const sfx = resolveHurtSfx(this.spec);
                if (sfx) {
                    EventBus.emit(SFX_EVENT(sfx), {
                        key: `character:${this.spec.id}`,
                        throttleMs: this.spec.sfx?.throttleMs,
                    });
                }
            }
        }
        if (spDelta !== 0) this.sp = Math.max(0, Math.min(this.spec.sp, this.sp + spDelta));
    }

    /**
     * Take a hit from the world. Flat armour is applied here, once, so every
     * damage source shares the same clamp and a soaked hit can never heal.
     */
    hurt(damage: number): void {
        const taken = damageAfterArmor(damage, this.spec.armor ?? 0);
        if (taken <= 0) return;
        this.heal(-taken, 0);
    }

    /**
     * The skill's cooldown as the armour ladder and the whale blessing leave it.
     *
     * Extracted because two places need the identical number: the press (`useSkill`)
     * and the hit that breaks a ward (`absorbIncomingHit` starts its clock there).
     */
    private skillCooldownMs(): number {
        const skill = this.spec.skill;
        if (!skill) return 0;
        const skillLevel = useGameStore.getState().upgradeLevels.armor ?? 0;
        const scaled = scaledSkillCooldown(skill.cooldownMs, skillLevel);
        const blessing = blessingApplies(
            useGameStore.getState().selectedCharacterId ?? undefined,
            useGameStore.getState().petBonus?.percent ?? 0,
        );
        return scaled * (blessing ? WHALE_BLESSING.cooldownMul : 1);
    }

    /** Add `fraction * currentWeaponClipSize` bullets to the active weapon. */
    refillAmmo(fraction: number): void {
        this.parts.weapons.refillActiveAmmo(fraction);
    }

    /** Switch to a named weapon if it's in the hotbar. No-op if not present. */
    pickUpWeapon(weaponId: string): boolean {
        return this.parts.weapons.swapToWeapon(weaponId);
    }

    /**
     * Add a weapon (resolved from `weaponsById`) to the next empty
     * slot. Returns `'added'` / `'capped'` / `'unknown'` so the caller
     * (tavern pickup) can decide whether to consume the drop or show
     * the replace-HUD.
     */
    tryPickupWeaponById(
        weaponId: string,
        weaponsById: ReadonlyMap<string, import('@/lib/weapons').WeaponSpec>,
    ): 'added' | 'capped' | 'unknown' | 'merged' {
        const spec = weaponsById.get(weaponId);
        if (!spec) return 'unknown';

        // Already carrying it: merge the two into one instead of taking a second slot.
        // Gemini already owns an assault rifle, so the cat's gift used to leave her with
        // two of them; the same happened to GPT at the dragon throne.
        if (this.parts.weapons.hasWeapon(weaponId)) {
            useGameStore.getState().mergeOwnedWeapon(weaponId, maxWeaponUpgradeLevel(spec));
            // The store is a mirror - the guns in her hands are THIS object, so the
            // refill has to reach the live slots too.
            EventBus.emit(WEAPONS_REFILL_ONE_EVENT, { weaponId });
            return 'merged';
        }

        return this.parts.weapons.tryPickupWeapon(spec);
    }

    /** Replace the weapon in `slotIndex` with the spec resolved from
     *  `weaponsById`. Returns false when the index is out of range or
     *  the id is unknown. */
    replaceWeaponSlot(
        slotIndex: number,
        weaponId: string,
        weaponsById: ReadonlyMap<string, import('@/lib/weapons').WeaponSpec>,
    ): boolean {
        const spec = weaponsById.get(weaponId);
        if (!spec) return false;
        this.parts.weapons.replaceSlot(slotIndex, spec);
        return true;
    }

    /** Maximum weapon slots this character can hold (from `weaponMax`). */
    getWeaponMax(): number {
        return this.parts.weapons.getMaxSlots();
    }

    /** Tear down all bindings and visual resources. */
    destroy(): void {
        for (const fn of this.cleanupFns) fn();
        this.cleanupFns.length = 0;
        for (const g of this.activeDodgeGhosts) g.destroy();
        this.activeDodgeGhosts.length = 0;
        this.parts.sprite.destroy();
        this.scene.matter.world.remove(this.parts.body);
    }

    /**
     * Announce the skill's state for the HUD's E badge: how much cooldown is
     * left and whether the SP pool covers the cost.
     *
     * Pushed only when the badge would actually look different — a cooldown
     * countdown changes in whole seconds of "still cooling", so re-rendering
     * the HUD ten times a second bought nothing. Three coarse signals are
     * enough: the tone bucket, whether SP covers the cost, and the headgear's
     * worn flag.
     */
    /**
     * Push the current HP / SP / ammo to the React HUD right now.
     *
     * The per-frame tick does this, but a paused scene has no tick: drinking a potion
     * from the backpack while the game is paused used to change her real HP and leave
     * the bar still, so the heal looked like it only landed when the bag closed.
     */
    /**
     * Count how often the flip / animation key / frame changes, once a second, and
     * publish it. "The sprite twitches" is one of three different bugs and this is the
     * cheapest way to tell which one the player is looking at.
     */
    private publishSpriteDebug(
        sprite: Phaser.GameObjects.Sprite,
        velocity: { x: number; y: number },
    ): void {
        if (!this.debugSprite) return;
        const now = this.scene.time.now;
        const flip = sprite.flipX;
        const anim = sprite.anims?.currentAnim?.key ?? '';
        const frame = sprite.anims?.currentFrame?.index ?? -1;

        if (flip !== this.dbgLastFlip) {
            this.dbgFlipCount += 1;
            this.dbgLastFlip = flip;
        }
        if (anim !== this.dbgLastAnim) {
            this.dbgAnimCount += 1;
            this.dbgLastAnim = anim;
            this.dbgHistory.push(`${Math.round(now)}ms ${anim || '(none)'}`);
            if (this.dbgHistory.length > 6) this.dbgHistory.shift();
        }
        if (frame !== this.dbgLastFrame) {
            this.dbgFrameCount += 1;
            this.dbgLastFrame = frame;
        }
        if (this.dbgWindowStart === 0) this.dbgWindowStart = now;
        if (now - this.dbgWindowStart >= 1000) {
            this.dbgRates = {
                flips: this.dbgFlipCount,
                anims: this.dbgAnimCount,
                frames: this.dbgFrameCount,
            };
            this.dbgFlipCount = 0;
            this.dbgAnimCount = 0;
            this.dbgFrameCount = 0;
            this.dbgWindowStart = now;
        }

        const round = (n: number): number => Math.round(n * 100) / 100;
        (window as unknown as Record<string, unknown>).__spriteDebug = {
            facing: this.facing,
            flip,
            anim,
            frame,
            vx: round(velocity.x),
            vy: round(velocity.y),
            flipsPerSec: this.dbgRates.flips,
            animSwitchesPerSec: this.dbgRates.anims,
            frameChangesPerSec: this.dbgRates.frames,
            history: this.dbgHistory.join(' | '),
        };
    }

    /** Current HP / SP pools. Used by pickup rules (the HP shard auto-drinks). */
    vitals(): { hp: number; maxHp: number; sp: number; maxSp: number } {
        return { hp: this.hp, maxHp: this.spec.hp, sp: this.sp, maxSp: this.spec.sp };
    }

    refreshHud(): void {
        this.parts.hud?.update(this.spec, this.hp, this.sp);
        if (this.parts.weapons && this.parts.weaponHud) {
            this.parts.weaponHud.draw(this.parts.weapons, this.scene.time.now);
        }
    }

    private publishSkillStatus(now: number): void {
        const skill = this.spec.skill;
        if (!skill) return;
        const readyInMs = Math.max(0, this.skillRuntime.readyAt - now);
        const skillLevel = useGameStore.getState().upgradeLevels.armor ?? 0;
        const spCost = scaledSkillSpCost(skillSpCost(skill, this.spec.sp), skillLevel);
        const signature = `${readyInMs > 0 ? 'cooling' : 'ready'}|${this.sp >= spCost}|${
            this.skillRuntime.hitsLeft > 0 || this.skillRuntime.shieldHp > 0
        }`;
        if (signature === this.lastSkillStatusSignature) return;
        this.lastSkillStatusSignature = signature;
        EventBus.emit('skill:status', {
            readyInMs,
            sp: this.sp,
            spCost,
            wornHits: this.skillRuntime.hitsLeft,
            wornShield: this.skillRuntime.shieldHp,
        });
    }

    /** Drive one tick manually — useful for tests; normally scene events do it. */
    update(now: number): void {
        const kb = this.scene.input.keyboard!;
        const mm = this.mobileMove;
        const intent = moveIntent({
            up: kb.addKey(KEY_W).isDown || (mm?.vy ?? 0) < -0.2,
            down: kb.addKey(KEY_S).isDown || (mm?.vy ?? 0) > 0.2,
            left: kb.addKey(KEY_A).isDown || (mm?.vx ?? 0) < -0.2,
            right: kb.addKey(KEY_D).isDown || (mm?.vx ?? 0) > 0.2,
        });

        // ── Dodge initiation ────────────────────────────────────────
        const spaceDown =
            kb.addKey(KEY_SPACE).isDown || kb.addKey(KEY_K).isDown || this.mobileDodge;
        // ── Skill (E) ───────────────────────────────────────────────
        // One path for every kind — see lib/characters/skill. The press is
        // level-triggered; the skill's own cooldown gates repeats. GPT's roar
        // is the exception: its effect belongs to the monsters, so the
        // character only pays for it and announces it.
        if (this.spec.skill && kb.addKey(KEY_E).isDown) {
            // Skill growth rides the armour ladder (0..5): +10 SP, -2s cooldown
            // per level, so the price the badge shows is the price charged.
            const skillLevel = useGameStore.getState().upgradeLevels.armor ?? 0;
            const used = useSkill(
                this.spec.skill,
                this.skillRuntime,
                now,
                this.sp,
                this.spec.sp,
                scaledSkillCooldown(this.spec.skill.cooldownMs, skillLevel) *
                    (blessingApplies(
                        useGameStore.getState().selectedCharacterId ?? undefined,
                        useGameStore.getState().petBonus?.percent ?? 0,
                    )
                        ? WHALE_BLESSING.cooldownMul
                        : 1),
                // 九命猫's shield scales with the same ladder the cost/cooldown do.
                skillLevel,
                // The price shown on the badge is the price charged: +10 SP per
                // level, so the affordability check has to see the same number.
                scaledSkillSpCost(skillSpCost(this.spec.skill, this.spec.sp), skillLevel),
            );
            if (used.used) {
                this.skillRuntime = used.runtime;
                // `used.spCost` is already the ladder-scaled price.
                this.sp = Math.max(0, this.sp - used.spCost);
                EventBus.emit('skill:used', { kind: this.spec.skill.kind });
                if (this.spec.skill.kind === 'dragon-roar') {
                    EventBus.emit('skill:dragon-roar', { hpFraction: this.spec.skill.hpFraction });
                }
            }
        }
        // Feed the HUD's E badge: cooldown left and whether SP covers the
        // cost. Throttled inside — the badge is not worth 60 events a second.
        this.publishSkillStatus(now);
        // Edge-triggered: clear the one-frame dodge flag the moment
        // the controller consumes it, so holding the touch button
        // doesn't queue a chain of dodges.
        this.mobileDodge = false;
        const dodge = dodgeIntent(
            spaceDown,
            intent,
            this.sp,
            this.spec.dodge.spCost,
            this.spec.dodge.cooldownMs,
            this.lastDodgeEndAt,
            this.dodgeActiveUntil,
            this.spec.dodge.speed,
            now,
        );
        if (dodge) {
            this.sp -= this.spec.dodge.spCost;
            this.dodgeVx = dodge.vx;
            this.dodgeVy = dodge.vy;
            this.dodgeActiveUntil = now + this.spec.dodge.durationMs;
            this.lastDodgeEndAt = now + this.spec.dodge.durationMs;
            const sfx = this.spec.sfx?.dodge;
            if (sfx) EventBus.emit(SFX_EVENT(sfx));
        }

        // ── Velocity resolution ─────────────────────────────────────
        // Hold the sprint key to move faster. The animation follows the speed
        // (walk -> run), not the other way round.
        const sprinting = kb.addKey(KEY_SHIFT).isDown;
        const speed = resolveMoveSpeed(this.spec.moveSpeed, sprinting);
        let finalVx = 0;
        let finalVy = 0;
        if (now < this.dodgeActiveUntil) {
            finalVx = this.dodgeVx;
            finalVy = this.dodgeVy;
        } else if (intent.vx !== 0 || intent.vy !== 0) {
            finalVx = intent.vx * speed;
            finalVy = intent.vy * speed;
        }
        this.parts.matter.Body.setVelocity(this.parts.body, { x: finalVx, y: finalVy });

        // ── Visual sync ─────────────────────────────────────────────
        const sprite = this.parts.sprite;
        const pos = this.parts.body.position;
        // Calculate visual offset. `left` shifts right (+) / left (-), `bottom` shifts up (-) / down (+)
        const rawX = this.spec.sprite?.offset?.left ?? this.spec.sprite?.offset?.x ?? 0;
        const rawY =
            this.spec.sprite?.offset?.bottom !== undefined
                ? -this.spec.sprite.offset.bottom
                : (this.spec.sprite?.offset?.y ?? 0);
        const offX = rawX * (sprite.flipX ? -1 : 1);
        const offY = rawY;
        sprite.setPosition(pos.x + offX, pos.y + this.spec.body.halfH + offY);
        // Y-sort anchor for the player stack (sprite < shadow < bullets <
        // weapon). Mirrors MonsterController.computeFootY so the player and
        // monsters share one Y-sort layer — a monster at footY=900 no longer
        // draws in front of a player at footY=200 just because 900 > 20.
        const footY = Math.round(pos.y + (sprite.displayHeight / 2 - this.spec.body.halfH));
        sprite.setDepth(footY);

        // Player hurt flash visual feedback (danger crimson additive highlight)
        // The headgear used to tint ADDITIVELY, which pushes light art to pure
        // white - the owner's "释放技能后变成了全白". It now multiplies; the hurt
        // flash keeps its additive blow-out because it lasts three frames.
        const tint = pickBodyTint({
            hurtFlash: now < this.hurtFlashUntil,
            headgearWorn: this.skillRuntime.hitsLeft > 0 || this.skillRuntime.shieldHp > 0,
            headgearTint:
                this.spec.skill?.kind === 'headgear'
                    ? (this.spec.skill.tintColor ?? HEADGEAR_DEFAULT_TINT)
                    : HEADGEAR_DEFAULT_TINT,
            defaultTint: HEADGEAR_DEFAULT_TINT,
        });
        if (tint) {
            sprite.setTint(tint.color);
            (sprite as any).setTintMode?.(tint.mode);
        } else if ((sprite as any).tintMode !== 0) {
            sprite.clearTint();
            (sprite as any).setTintMode?.(0);
        }

        // Dodge roll afterimage trail (semi-transparent fading cyan/sky blue ghosts)
        if (now < this.dodgeActiveUntil && now - this.lastGhostAt >= 40) {
            this.lastGhostAt = now;
            this.spawnDodgeGhost(sprite, footY);
        }

        // Keep all active dodge afterimage ghosts strictly beneath the character sprite
        // (even if player dodges upwards against Y-sort direction)
        for (let i = 0; i < this.activeDodgeGhosts.length; i++) {
            const g = this.activeDodgeGhosts[i];
            if (g.active) {
                g.setDepth(footY - 1 - (this.activeDodgeGhosts.length - 1 - i) * 0.05);
            }
        }
        if (this.parts.shadow) {
            this.parts.shadow.setPosition(pos.x, pos.y + this.spec.body.halfH);
            this.parts.shadow.setDepth(footY - 2);
        }
        if (this.parts.debugBodyRect) {
            this.parts.debugBodyRect.setPosition(pos.x, pos.y);
            this.parts.debugBodyRect.setDepth(footY + 1);
        }
        if (this.parts.debugHitboxRect) {
            this.parts.debugHitboxRect.setPosition(
                pos.x,
                pos.y + this.spec.body.halfH - sprite.displayHeight / 2,
            );
            this.parts.debugHitboxRect.setDepth(footY + 2);
        }
        // Facing follows her feet, not the cursor.
        //
        // It used to be `sprite.setFlipX(cursorX < herX)` every frame: with the pointer
        // resting near her own x the comparison alternated and the sprite twitched left
        // and right. Aim still drives the weapon; the body only turns when she walks -
        // and walking straight up keeps whatever she was facing, so a lane change does
        // not spin her around.
        const bodyVelocity = this.parts.body.velocity;
        this.facing = facingFromMotion(bodyVelocity.x, bodyVelocity.y, this.facing);
        sprite.setFlipX(flipXForFacing(this.facing));
        this.publishSpriteDebug(sprite, bodyVelocity);

        // Cursor aiming only while the mouse scheme is live. Under the directional
        // scheme the arrows own the aim and the cursor is ignored, so a moving mouse
        // cannot quietly steal it back.
        if (useGameStore.getState().inputScheme === 'mouse') this.updateAimTarget(now);

        // ── Animation state machine ─────────────────────────────────
        this.driveAnims(intent.vx !== 0 || intent.vy !== 0, now < this.dodgeActiveUntil, sprinting);

        // ── SP regen: a slow trickle, rate-based ────────────────────
        // The owner brought this back, so skills and dodges slowly pay for
        // themselves again. Rate is `spRegenPerSec` (0.5 base, up to 2.0 with a
        // fully upgraded spirit ladder), accumulated in seconds. HP still does
        // NOT regenerate - that part of the old rule stands.
        // 鲸鲸祝福 tops both pools up: +2% max HP/s and +1% max SP/s on top of
        // the flat SP trickle. This is the one deliberate exception to "HP never
        // regenerates" - it is DeepSeek's alone and only at the maxed pet tier.
        const blessing = blessingApplies(
            useGameStore.getState().selectedCharacterId ?? undefined,
            useGameStore.getState().petBonus?.percent ?? 0,
        );
        let spRate = this.spec.spRegenPerSec ?? 0;
        if (blessing) {
            spRate += (this.spec.sp * WHALE_BLESSING.spRegenPerSecPct);
        }
        if (this.lastSpRegenAt === 0) this.lastSpRegenAt = now;
        const elapsedSec = Math.max(0, (now - this.lastSpRegenAt) / 1000);
        this.lastSpRegenAt = now;

        if (elapsedSec > 0) {
            if (spRate > 0 && this.sp < this.spec.sp) {
                this.sp = Math.min(this.spec.sp, this.sp + elapsedSec * spRate);
            }
            if (blessing && this.hp < this.spec.hp) {
                const healPerSec = this.spec.hp * WHALE_BLESSING.hpRegenPerSecPct;
                this.heal(Math.min(this.spec.hp - this.hp, elapsedSec * healPerSec), 0);
            }
        }

        // ── Footstep SFX (throttled; cadence from spec) ─────────────
        const moving = intent.vx !== 0 || intent.vy !== 0;
        const footstepThrottleMs = this.spec.sfx?.footstepThrottleMs ?? 200;
        if (
            moving &&
            now >= this.dodgeActiveUntil &&
            now - this.lastFootstepAt > footstepThrottleMs
        ) {
            const sfx = this.spec.sfx?.footstep;
            if (sfx) EventBus.emit(SFX_EVENT(sfx));
            this.lastFootstepAt = now;
        }

        // ── Low-HP heartbeat (threshold + pulse from spec) ──────────
        const lowHpThreshold = this.spec.sfx?.lowHpThreshold ?? 0.3;
        const lowHpPulseMs = this.spec.sfx?.lowHpPulseMs ?? 900;
        if (this.hp < this.spec.hp * lowHpThreshold && now - this.lastHeartbeatAt > lowHpPulseMs) {
            const sfx = this.spec.sfx?.lowHpHeartbeat;
            if (sfx) EventBus.emit(SFX_EVENT(sfx));
            this.lastHeartbeatAt = now;
        }

        // ── Mobile auto-aim (when FIRE is held on a touch device) ───
        // While the virtual FIRE button is down, override targetX/Y with
        // the nearest live monster every frame so bullets trail the
        // target — independent of the desktop cursor path. When no
        // monster exists, fall back to whatever the cursor set last.
        this.applyMobileAutoAim(pos);

        // Scheme B: the arrows own the aim, and the last direction is kept when
        // nothing is held — releasing mid-fight must not blank the target.
        if (useGameStore.getState().inputScheme === 'directional') this.applyKeyboardAim(pos);

        // ── Weapon update ───────────────────────────────────────────
        // Default aiming target when cursor hasn't moved yet aligns with character's sprite facing (flipX)
        const defaultAimX = pos.x + (sprite.flipX ? -100 : 100);
        const defaultAimY = pos.y - this.spec.body.halfH;

        // Where her hands actually are, not where her physics box is. The old
        // `-halfH` orbit sits at knee height on a tall sprite (the owner's
        // report: "武器位置太低了，在膝盖处"). Derived from the drawn height, so it
        // scales with the art instead of with the hitbox.
        const rawSpriteY =
            this.spec.sprite?.offset?.bottom !== undefined
                ? -this.spec.sprite.offset.bottom
                : (this.spec.sprite?.offset?.y ?? 0);
        const handUp = handUpOffset(sprite.displayHeight, this.spec.body.halfH + rawSpriteY);

        this.parts.weapons.update(
            now,
            this.targetX ?? defaultAimX,
            this.targetY ?? defaultAimY,
            (this.firing || this.mobileFiring || kb.addKey(KEY_J).isDown) &&
                now >= this.dodgeActiveUntil,
            handUp,
            footY,
        );

        // ── HUD ─────────────────────────────────────────────────────
        this.parts.hud.update(this.spec, this.hp, this.sp);
        this.parts.weaponHud.draw(this.parts.weapons, this.scene.time.now);
        // Character body position center is at (feetY - halfH).
        // Distance from body.position to sprite top is: displayHeight - halfH
        const topOffset = Math.max(
            this.spec.body.halfH,
            this.parts.sprite.displayHeight - this.spec.body.halfH,
        );
        const slotState = this.parts.weapons.getActiveSlotState();
        this.parts.statusHud.update(
            {
                name: pickText(this.spec.name, this.spec.nameZh),
                ...slotState,
                hp: this.hp,
                maxHp: this.spec.hp,
                showHpBar: true,
                sp: this.sp,
                maxSp: this.spec.sp,
                showSpBar: true,
                dodgeActive: now < this.dodgeActiveUntil,
                dodgeCooldownStartedAt: this.lastDodgeEndAt,
                dodgeCooldownTimeMs: this.spec.dodge.cooldownMs,
            },
            now,
            topOffset,
        );
    }

    // ─── Internals ──────────────────────────────────────────────────────

    /**
     * State machine: idle ↔ run ↔ dodge.
     *   - `dodge` plays for the entire dodge window (covers the full
     *     roll animation, even past the 220ms physics window).
     *   - `walk` while moving, `run` while moving with the sprint key held
     *     (a character that declares no `run` anim keeps walking instead).
     *   - `idle` otherwise.
     *   - When the dodge roll's animationcomplete fires, onAnimComplete
     *     chains to walk or idle based on current movement.
     *
     * Each anim is gated on `scene.anims.exists(key)` so a character
     * without declared anims falls through silently (debug fallback).
     */
    private driveAnims(isMovingInput: boolean, isDodging: boolean, isSprinting = false): void {
        if (!this.spec.anims) return;
        const sprite = this.parts.sprite;
        const walkKey = animKey(this.spec, 'walk');
        const runKey = animKey(this.spec, 'run');
        const dodgeKey = animKey(this.spec, 'dodge');
        const cur = sprite.anims.currentAnim?.key ?? null;
        // `anims.stop()` leaves `currentAnim` pointing at the animation that just
        // stopped, so a frozen pose still reports "walk". Compare the playing flag too,
        // or moving off a still pose never restarts the cycle and she slides.
        const playing = sprite.anims.isPlaying;

        if (isDodging && this.scene.anims.exists(dodgeKey)) {
            // Active dodge window — start the roll if not already running.
            if (needsAnimPlay(cur, dodgeKey, playing)) sprite.anims.play(dodgeKey, true);
            return;
        }
        if (cur === dodgeKey) {
            // Dodge window ended but the roll animation is still in
            // flight — let it play through. onAnimComplete chains to
            // walk or idle based on movement state.
            return;
        }
        const state = resolveLocomotion(isMovingInput, isSprinting);
        if (state === 'run' && this.scene.anims.exists(runKey)) {
            if (needsAnimPlay(cur, runKey, playing)) sprite.anims.play(runKey, true);
        } else if (state !== 'idle') {
            // A character that declares no `run` anim still sprints — it just
            // keeps the walk cycle while it does.
            if (needsAnimPlay(cur, walkKey, playing) && this.scene.anims.exists(walkKey)) {
                sprite.anims.play(walkKey, true);
            }
        } else {
            // Standing still keeps her direction. Every frame on these sheets is drawn
            // front-on, so a symmetric idle pose mirrored for "left" looks identical to
            // "facing the front"; the lean of the walk cycle is the only art that reads as
            // a side. Freeze on that instead of snapping back to centred.
            const pose = idlePoseFor(this.facing, this.spec.anims?.walk?.frames?.[0]);
            const poseKey = pose.anim ? animKey(this.spec, pose.anim) : null;
            if (poseKey && this.scene.anims.exists(poseKey)) {
                if (needsAnimPlay(cur, poseKey, playing)) sprite.anims.play(poseKey, true);
            } else if (pose.frame !== null) {
                if (playing) sprite.anims.stop();
                if (sprite.frame.name !== String(pose.frame)) sprite.setFrame(pose.frame);
            }
        }
    }

    /** Spawn semi-transparent afterimage ghost during dodge roll. */
    private spawnDodgeGhost(sprite: Phaser.GameObjects.Sprite, footY: number): void {
        const ghost = this.scene.add.sprite(
            sprite.x,
            sprite.y,
            sprite.texture.key,
            sprite.frame.name,
        );
        ghost.setOrigin(sprite.originX, sprite.originY);
        ghost.setFlipX(sprite.flipX);
        ghost.setScale(sprite.scaleX, sprite.scaleY);
        ghost.setDepth(footY - 1);
        ghost.setAlpha(0.55);
        // Soft silver-white micro-glow (clean additive shimmer over original colors)
        ghost.setTint(0x606060);
        (ghost as any).setTintMode?.(2); // TintModes.ADD = 2
        this.activeDodgeGhosts.push(ghost);

        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 220,
            ease: 'Quad.easeOut',
            onComplete: () => {
                const idx = this.activeDodgeGhosts.indexOf(ghost);
                if (idx !== -1) this.activeDodgeGhosts.splice(idx, 1);
                ghost.destroy();
            },
        });
    }

    /**
     * Hooked on `sprite.on('animationcomplete', ...)` in the constructor.
     * When the dodge roll finishes, chain to run (if still moving) or
     * idle (otherwise). Other animation ends are no-ops so this stays
     * safe to bind once and forget.
     */
    private onAnimComplete(): void {
        if (!this.spec.anims) return;
        const sprite = this.parts.sprite;
        const cur = sprite.anims.currentAnim?.key;
        const dodgeKey = animKey(this.spec, 'dodge');
        if (cur !== dodgeKey) return;
        // Dodge roll finished — sample current movement to pick the
        // right follow-up. Sampling at completion time (not at the
        // original dodge trigger) means releasing WASD during the roll
        // correctly transitions to idle.
        const kb = this.scene.input.keyboard!;
        const intent = moveIntent({
            up: kb.addKey(KEY_W).isDown,
            down: kb.addKey(KEY_S).isDown,
            left: kb.addKey(KEY_A).isDown,
            right: kb.addKey(KEY_D).isDown,
        });
        if (intent.vx !== 0 || intent.vy !== 0) {
            const walkKey = animKey(this.spec, 'walk');
            if (this.scene.anims.exists(walkKey)) sprite.anims.play(walkKey, true);
        } else {
            const idleKey = animKey(this.spec, 'idle');
            if (this.scene.anims.exists(idleKey)) sprite.anims.play(idleKey, true);
        }
    }

    private bindKeyboard(): void {
        const kb = this.scene.input.keyboard!;
        const weapons = this.parts.weapons;
        kb.addKey(KEY_W);
        kb.addKey(KEY_A);
        kb.addKey(KEY_S);
        kb.addKey(KEY_D);
        kb.addKey(KEY_SPACE);

        kb.addKey(KEY_ONE).on('down', () => weapons.switchTo(0));
        kb.addKey(KEY_TWO).on('down', () => weapons.switchTo(1));
        kb.addKey(KEY_THREE).on('down', () => weapons.switchTo(2));
        kb.addKey(KEY_FOUR).on('down', () => weapons.switchTo(3));
        kb.addKey(KEY_FIVE).on('down', () => weapons.switchTo(4));
        kb.addKey(KEY_SIX).on('down', () => weapons.switchTo(5));
        kb.addKey(KEY_SEVEN).on('down', () => weapons.switchTo(6));
        kb.addKey(KEY_R).on('down', () => weapons.manualReload());
        // F is the reload key people expect from other shooters. R stays
        // bound so nobody's existing habit breaks.
        kb.addKey(KEY_F).on('down', () => weapons.manualReload());
        // Q walks the hotbar one weapon at a time, wrapping at the end.
        kb.addKey(KEY_Q).on('down', () => weapons.cycleSlot(1));
    }

    /**
     * Subscribe to touch-control events emitted by `TouchControls.tsx`.
     * Auto-aim lives in `update()`'s `applyMobileAutoAim` so it tracks
     * the nearest monster every frame the FIRE button is held —
     * independent of the desktop cursor path.
     */
    private bindMobile(): void {
        const onMove = (payload?: { vx?: number; vy?: number } | null) => {
            if (!payload || (payload.vx === 0 && payload.vy === 0)) {
                this.mobileMove = null;
            } else {
                this.mobileMove = { vx: payload.vx ?? 0, vy: payload.vy ?? 0 };
            }
        };
        const onFiring = (payload?: boolean) => {
            const wasFiring = this.mobileFiring;
            this.mobileFiring = payload === true;
            // Mirror desktop `pointerleave`: hide the crosshair on
            // FIRE release so the lock indicator doesn't linger on
            // screen after the player lets go.
            if (wasFiring && !this.mobileFiring) {
                EventBus.emit('aim-crosshair-update', {
                    x: -100,
                    y: -100,
                    isLocked: false,
                    visible: false,
                });
            }
        };
        const onDodge = (payload?: boolean) => {
            // Edge-trigger: only set when the touch starts; release
            // is a no-op (the controller clears the flag on consume).
            if (payload === true) this.mobileDodge = true;
        };

        EventBus.on('mobile:move', onMove);
        EventBus.on('mobile:firing', onFiring);
        EventBus.on('mobile:dodge', onDodge);
        EventBus.on('mobile:weapon:switch', (payload?: { index?: number }) => {
            const idx = payload?.index;
            if (typeof idx === 'number' && idx >= 0) this.parts.weapons.switchTo(idx);
        });
        this.cleanupFns.push(() => {
            EventBus.removeListener('mobile:move', onMove);
            EventBus.removeListener('mobile:firing', onFiring);
            EventBus.removeListener('mobile:dodge', onDodge);
            EventBus.removeListener('mobile:weapon:switch');
        });
    }

    // Pointer tracking & magnetic aim assist state
    private rawClientX = 0;
    private rawClientY = 0;
    private lastClientX = 0;
    private lastClientY = 0;
    private hasPointerMoved = false;

    /**
     * While the mobile FIRE button is held, override `targetX/Y` with
     * the live position of the nearest monster each frame so bullets
     * chase the target even after they spawn. Re-emits the crosshair
     * event so the on-screen reticle follows.
     *
     * No-op when `mobileFiring` is false (desktop path unchanged) or
     * when no monsters are alive (targetX/Y keep their last value, then
     * weapons.update falls through to `defaultAimX/Y` on the next frame).
     */
    /**
     * Touch: the direction of travel is the aim (owner's call for ⑤).
     *
     * The old version snapped to the nearest live monster while FIRE was held — that
     * is the same auto-targeting the redesign removes on desktop, so it goes here
     * too. Walking is aiming: the player can face anything they can walk at, and
     * cannot strafe-shoot sideways. Adding a right-hand stick later is a small change
     * to this method alone.
     */
    private applyMobileAutoAim(pos: { x: number; y: number }): void {
        const mm = this.mobileMove;
        if (!mm) return;
        const direction = aimFromIntent({
            up: mm.vy < -0.2,
            down: mm.vy > 0.2,
            left: mm.vx < -0.2,
            right: mm.vx > 0.2,
        });
        if (!direction) return;

        const point = aimPointFrom(pos, direction, AIM_DIRECTIONAL_RANGE);
        this.targetX = point.x;
        this.targetY = point.y;
        this.publishCrosshair(point.x, point.y);
    }

    /**
     * Scheme A: the cursor is the aim.
     *
     * The old version was a magnet: it snapped to the nearest monster within 120px,
     * held that lock out to 280px, released it on a fast flick, and re-based the
     * cursor onto the monster so the release felt continuous. The owner's redesign
     * removed all of that — aim is now exactly where the pointer is, everywhere.
     * Nothing about lock state survives, so the crosshair has no `isLocked` to show.
     */
    private updateAimTarget(_now: number): void {
        if (!this.hasPointerMoved) return;

        const canvas = (this.scene as any).game?.canvas as HTMLCanvasElement | undefined;
        if (!canvas) return;

        const rectEl = appRect(canvas);
        const camera = this.scene.cameras.main;
        if (!rectEl || !camera) return;

        const worldX =
            camera.scrollX + (this.rawClientX - rectEl.left) * (camera.width / rectEl.width);
        const worldY =
            camera.scrollY + (this.rawClientY - rectEl.top) * (camera.height / rectEl.height);

        this.targetX = worldX;
        this.targetY = worldY;
        this.publishCrosshair(worldX, worldY);
    }

    /**
     * Scheme B: eight-way aim from the arrow keys.
     *
     * The aim point is placed `AIM_DIRECTIONAL_RANGE` out along the direction, which
     * is enough for every weapon — they shoot along the line, not to the point.
     */
    private applyKeyboardAim(pos: { x: number; y: number }): void {
        const kb = this.scene.input.keyboard;
        if (!kb) return;
        const direction = aimFromIntent({
            up: kb.addKey(KEY_UP).isDown,
            down: kb.addKey(KEY_DOWN).isDown,
            left: kb.addKey(KEY_LEFT).isDown,
            right: kb.addKey(KEY_RIGHT).isDown,
        });
        if (!direction) return;

        const point = aimPointFrom(pos, direction, AIM_DIRECTIONAL_RANGE);
        this.targetX = point.x;
        this.targetY = point.y;
        this.publishCrosshair(point.x, point.y);
    }

    /** Keep the HUD reticle on whatever point the aim resolves to this frame. */
    private publishCrosshair(worldX: number, worldY: number): void {
        const camera = this.scene.cameras.main;
        if (!camera) return;
        EventBus.emit('aim-crosshair-update', {
            x: (worldX - camera.scrollX) * (1536 / camera.width),
            y: (worldY - camera.scrollY) * (864 / camera.height),
            isLocked: false,
            visible: true,
        });
    }

    private bindPointer(): void {
        const canvas = (this.scene as any).game?.canvas as HTMLCanvasElement | undefined;
        if (!canvas) return;

        const onPointerEvent = (e: PointerEvent) => {
            const now = performance.now();
            // App space — on mobile the whole app is rotated 90°, so raw
            // clientX/Y would aim at right angles to the cursor.
            const p = toAppPoint(e.clientX, e.clientY);
            if (!this.hasPointerMoved) {
                this.lastClientX = p.x;
                this.lastClientY = p.y;
                this.rawClientX = p.x;
                this.rawClientY = p.y;
                this.hasPointerMoved = true;
                    this.updateAimTarget(now);
                return;
            }

            const dx = p.x - this.lastClientX;
            const dy = p.y - this.lastClientY;

            this.lastClientX = p.x;
            this.lastClientY = p.y;

            // Accumulate relative delta onto rawClientX/Y so breakout starts directly from monster anchor
            this.rawClientX += dx;
            this.rawClientY += dy;

            this.updateAimTarget(now);
        };

        const onDown = (e: PointerEvent) => {
            onPointerEvent(e);
            this.firing = true;
        };
        const stop = () => {
            this.firing = false;
        };
        const onLeave = () => {
            this.firing = false;
            this.hasPointerMoved = false;
            EventBus.emit('aim-crosshair-update', {
                x: -100,
                y: -100,
                isLocked: false,
                visible: false,
            });
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointerleave', onLeave);

        // Window-level pointermove: any HUD overlay (weapon slots,
        // character hub, joystick, etc.) sits on top of the canvas with
        // `pointer-events: auto`, so canvas pointermove stops firing the
        // moment the cursor enters them. Window listeners keep aim
        // tracking continuous regardless of which DOM layer the cursor
        // happens to be in.
        //
        // Filter by viewport position rather than DOM ancestry: HUD
        // overlays aren't children of `#game-container` (they're siblings
        // inside `#app`), so a contains() check would reject them. We
        // accept the event whenever the cursor sits inside the canvas's
        // visible rect — which naturally includes all canvas-stacked
        // HUD chrome and naturally excludes the editor panel.
        const onWindowMove = (e: PointerEvent): void => {
            const r = appRect(canvas);
            if (r.width <= 0 || r.height <= 0) return;
            const { x: cx, y: cy } = toAppPoint(e.clientX, e.clientY);
            if (cx < r.left || cx > r.left + r.width || cy < r.top || cy > r.top + r.height) return;
            // On touch devices, joystick dragging (left half) must not hijack the aiming crosshair
            if (e.pointerType === 'touch' && cx < r.left + r.width / 2) return;
            onPointerEvent(e);
        };
        window.addEventListener('pointermove', onWindowMove);
        window.addEventListener('pointerleave', onLeave);

        this.cleanupFns.push(() => {
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointerup', stop);
            canvas.removeEventListener('pointerleave', onLeave);
            window.removeEventListener('pointermove', onWindowMove);
            window.removeEventListener('pointerleave', onLeave);
        });
    }

    /**
     * React to HP reaching 0 from a positive value. Flips the UI store
     * flag (the React <DeathOverlay> watches it) and pauses the Phaser
     * scene so the world freezes while the player decides to restart.
     *
     * Restart is handled by React: the overlay button calls
     * `restartSceneWith` with the cached ResolvedScene — the LoadScene
     * constructor reseeds HP from the spec.
     */
    private handleDeath(): void {
        this.parts.sprite.clearTint();
        (this.parts.sprite as any).setTintMode?.(0);
        useGameStore.getState().setDead(true);
        EventBus.emit('player-died');
        // Pause stops the matter physics step + animation ticks. The
        // scene remains in memory; restart rebuilds it.
        this.scene.scene.pause();
    }
}
