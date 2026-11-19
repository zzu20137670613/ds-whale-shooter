/**
 * src/game/monsters/boss-attacks.ts
 * --------------------------------------------------------------------------
 * The scene-side half of Claude's four attacks.
 *
 * Geometry and numbers live in `lib/bosses/attacks.ts`; this module only turns them
 * into projectiles and ground circles. It takes a small structural actor rather than
 * the controller's `Monster` so the module stays independent of the controller's
 * internals — the controller hands over what an attack needs and nothing else.
 */

import * as Phaser from 'phaser';

import type { BulletRecord } from '@/game/weapons/weapon';
import { CAT, PROJECTILE_MONSTER_MASK } from '@/lib/constants';
import {
    BOSS_ATTACKS,
    WRATH_BASE_RADIUS,
    BOSS_BULLET_SIZE_MULTIPLIER,
    BARRAGE_SECOND_RING_DELAY_MS,
    BOSS_BULLET_LIFE_MS,
    BOSS_BULLET_SPEED_MULTIPLIER,
    CANNON_SHOTS,
    barrageAngles,
    cannonVolley,
    wrathPositions,
    WRATH_FUSE_MS,
} from '@/lib/bosses/attacks';
import { entropyRadius } from '@/lib/bosses/phases';
import { EventBus } from '@/lib/events/bus';
import { spawnProjectile } from '@/game/weapons/weapon';
import { spawnWrathCircle } from '@/game/monsters/wrath';

/** What an attack needs to know about its caster. */
export interface BossActor {
    x: number;
    y: number;
    /** Projectile the boss's weapon would have fired, used for visuals/speed/size. */
    projectile?: {
        speed: number;
        radius: number;
        width: number;
        height: number;
        color?: number;
        texture?: string;
        scale?: number;
    };
}

export interface BossAttackContext {
    scene: Phaser.Scene;
    matter: unknown;
    actor: BossActor;
    /** Aim angle in radians, already pointed at the player. */
    aim: number;
    /** Damage multiplier from the current phase. */
    damageScale: number;
    /** How many wrath waves this phase has already fired (entropy). */
    wrathWaves: number;
    /** 这一阶段的射程倍率（阶段 3/4 是 2，其余 1）。 */
    bulletLifeScale?: number;
    /** Player position, for wrath targeting. */
    player: { x: number; y: number };
    /** Deal `damage` to the player if they are inside `radius` of (x, y). */
    damageAt: (x: number, y: number, radius: number, damage: number) => void;
    /**
     * Hand a fresh shell to the owner, so it gets moved and culled.
     *
     * Without this the shells were created and then forgotten: `spawnProjectile` returns a
     * record that the caller must keep, and the per-frame sync only walks the records it was
     * given. Fifty-three shells sat frozen at her feet - the purple blob in the owner's
     * screenshot - while nothing ever crossed the room.
     */
    trackBullet?: (record: BulletRecord) => void;
}

/** Above the painted floor, below nothing: her shells must never hide under the pavement. */
const BOSS_BULLET_DEPTH = 1_000_000;

/** Gap between two bullets of one sweep - the original rhythm. */
const BARRAGE_STEP_MS = 26;

/** How many identical sweeps one 漫天轰炸 fires. */
const BARRAGE_SWEEPS = 2;

const DEFAULT_PROJECTILE: NonNullable<BossActor['projectile']> = {
    speed: 420,
    radius: 9,
    width: 18,
    height: 18,
};

/** The bullet every ranged boss attack shares: twice the size, half the speed. */
function bossBullet(ctx: BossAttackContext) {
    const source = ctx.actor.projectile ?? DEFAULT_PROJECTILE;
    return {
        speed: source.speed * BOSS_BULLET_SPEED_MULTIPLIER,
        size: {
            radius: source.radius * BOSS_BULLET_SIZE_MULTIPLIER,
            width: source.width * BOSS_BULLET_SIZE_MULTIPLIER,
            height: source.height * BOSS_BULLET_SIZE_MULTIPLIER,
            color: source.color ?? 0xf472b6,
        },
        texture: source.texture,
        scale: source.scale,
    };
}

function fireOne(
    ctx: BossAttackContext,
    angle: number,
    damage: number,
    depth: number | undefined,
): void {
    const bullet = bossBullet(ctx);
    const record = spawnProjectile(
        ctx.scene,
        ctx.matter,
        { x: ctx.actor.x, y: ctx.actor.y },
        { x: Math.cos(angle), y: Math.sin(angle) },
        {
            label: 'monster-projectile',
            category: CAT.MONSTER_PROJECTILE,
            mask: PROJECTILE_MONSTER_MASK,
            speed: bullet.speed,
            damage,
            size: bullet.size,
            texture: bullet.texture,
            scale: bullet.scale,
            // 射程 = 速度 × 存活时间，所以「打得更远」在这里就是活得更久。
            lifeMs: BOSS_BULLET_LIFE_MS * (ctx.bulletLifeScale ?? 1),
            // Her shells were drawn at the flat DEPTH.BULLET and vanished under the ruins'
            // pavement. Nothing else in the game shares this layer, so pinning them sits them
            // above the floor without touching the player's own shots.
            depth: depth ?? BOSS_BULLET_DEPTH,
        },
    );
    ctx.trackBullet?.(record);
}

/**
 * ① 三连炮: three shots, each a fan of three. Staggered so the nine bullets arrive as
 * a rolling wall rather than a single flat line — the design calls for them to be able
 * to hit at once, which a stagger still allows at point-blank.
 */
export function fireCannon(ctx: BossAttackContext): void {
    const damage = BOSS_ATTACKS['triple-cannon'].damage * ctx.damageScale;
    for (let shot = 0; shot < CANNON_SHOTS; shot += 1) {
        ctx.scene.time.delayedCall(shot * 140, () => {
            for (const angle of cannonVolley(ctx.aim)) {
                fireOne(ctx, angle, damage, undefined);
            }
        });
    }
}

/**
 * ③ 漫天轰炸: two rings of eight, clockwise, fired as one sweep rather than sixteen
 * simultaneous bullets so the player can find the gap.
 */
export function fireBarrage(ctx: BossAttackContext): void {
    const damage = BOSS_ATTACKS.barrage.damage * ctx.damageScale;
    const angles = barrageAngles();
    const step = BARRAGE_STEP_MS;
    const sweepMs = (angles.length - 1) * step;

    // Two rings, bundled: the second sweep starts 200ms after the first finishes, so the
    // player who just found a gap has to find another one immediately. The owner:
    // `顺时针炮弹机制第一轮结束之后0.2秒，再跟一轮，捆绑死，所有阶段boss通用`.
    for (let ring = 0; ring < BARRAGE_SWEEPS; ring += 1) {
        const ringOffset = ring * (sweepMs + BARRAGE_SECOND_RING_DELAY_MS);
        angles.forEach((angle, index) => {
            ctx.scene.time.delayedCall(ringOffset + index * step, () => {
                fireOne(ctx, angle, damage, undefined);
            });
        });
    }
}

/**
 * ④ 天谴轰炸: circles around the player, one second of warning, and a radius that grows
 * with every wave this phase has already fired.
 */
export function castWrath(ctx: BossAttackContext, count: number): void {
    const damage = BOSS_ATTACKS.wrath.damage * ctx.damageScale;
    const radius = entropyRadius(
        // A circle grows across a phase; the base comes from the geometry module.
        WRATH_BASE_RADIUS,
        ctx.wrathWaves,
    );

    const positions = wrathPositions(ctx.player, count, Math.random);
    EventBus.emit('boss:wrath', { count, radius });

    for (const position of positions) {
        spawnWrathCircle(ctx.scene, {
            x: position.x,
            y: position.y,
            radius,
            fuseMs: WRATH_FUSE_MS,
            onExplode: (x, y, blastRadius) => ctx.damageAt(x, y, blastRadius, damage),
        });
    }
}