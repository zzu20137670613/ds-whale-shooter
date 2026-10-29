/**
 * src/lib/bosses/attacks.ts
 * --------------------------------------------------------------------------
 * Claude's four attacks, as data and geometry.
 *
 * The numbers are the owner's, locked in `boss-神Claude-机制总表.md` §1.4 / §2:
 * the triple cannon, the melee swing, the sixteen-shot barrage, and 天谴 (phase 2
 * only). Damages here are phase-1 values; the controller multiplies them by the
 * phase's `damageScale`, so tuning lives in one place.
 *
 * Geometry is pure and lives here rather than in the scene so the shapes are
 * testable: "nine bullets, twelve degrees apart, clockwise rings" is a fact about the
 * attack, not a fact about Phaser.
 */

/** Bullets are twice the player's size and travel at half speed — §2 ①. */
export const BOSS_BULLET_SIZE_MULTIPLIER = 2;
export const BOSS_BULLET_SPEED_MULTIPLIER = 0.5;

/** 三发一组，每发三颗（一颗直线 + 两颗獠牙）；一局 9 颗，可以同时命中。 */
export const CANNON_SHOTS = 3;
export const CANNON_BULLETS_PER_SHOT = 3;
/** Half-angle of the two fang bullets, in degrees. */
export const CANNON_FANG_SPREAD_DEG = 10;

/** 漫天轰炸：两圈，每圈八方向，顺时针。 */
export const BARRAGE_RINGS = 2;
export const BARRAGE_SECTORS = 8;
/** The second ring is rotated by half a sector so the pattern reads as a fan. */
export const BARRAGE_RING_OFFSET_DEG = 22.5;

/** 天谴：三个圈，半血以下五个；落地 1 秒后爆。 */
export const WRATH_CIRCLES = 3;
export const WRATH_CIRCLES_LOW_HP = 5;
export const WRATH_FUSE_MS = 1000;
/** Explosion radius of one circle, before entropy growth. */
export const WRATH_BASE_RADIUS = 64;
/** How far from the player the circles may land. */
export const WRATH_MIN_DISTANCE = 48;
export const WRATH_MAX_DISTANCE = 150;

/**
 * How close the player has to be for the boss to swing instead of shoot.
 *
 * Not the weapon's `range`: her weapon is a mortar with 700 range, and using that as
 * the melee trigger would have her swinging a hitbox across the room. A swing is a
 * swing - arm's length, whatever she is holding.
 */
export const BOSS_MELEE_REACH = 96;

export interface BossAttackSpec {
    damage: number;
    /** Milliseconds the attack animation holds before it resolves. */
    windupMs: number;
}

/**
 * Phase-1 damage per attack, scaled per phase by the controller.
 *
 * The barrage hits for exactly what one cannon shell hits for (the owner's call,
 * 2026-10-29): same armour maths, same feel per bullet, just sixteen of them arriving
 * from every direction instead of nine down one line.
 */
export const BOSS_ATTACKS: Record<'triple-cannon' | 'melee' | 'barrage' | 'wrath', BossAttackSpec> = {
    'triple-cannon': { damage: 130, windupMs: 260 },
    melee: { damage: 140, windupMs: 180 },
    barrage: { damage: 130, windupMs: 420 },
    wrath: { damage: 180, windupMs: 500 },
};

/**
 * The three angles of one cannon shot, relative to the aim angle.
 *
 * One straight down the aim line and two fangs either side. Returned in radians so the
 * caller does not have to convert.
 */
export function cannonVolley(aimRadians: number): number[] {
    const spread = (CANNON_FANG_SPREAD_DEG * Math.PI) / 180;
    return [aimRadians - spread, aimRadians, aimRadians + spread];
}

/**
 * The sixteen angles of the barrage: two rings of eight, clockwise, the second ring
 * offset by half a sector.
 */
export function barrageAngles(): number[] {
    const step = (Math.PI * 2) / BARRAGE_SECTORS;
    const offset = (BARRAGE_RING_OFFSET_DEG * Math.PI) / 180;
    const angles: number[] = [];
    for (let ring = 0; ring < BARRAGE_RINGS; ring += 1) {
        for (let sector = 0; sector < BARRAGE_SECTORS; sector += 1) {
            angles.push(sector * step + ring * offset);
        }
    }
    return angles;
}

export interface Point {
    x: number;
    y: number;
}

/**
 * Where the wrath circles land: `count` points spread around the player, each in its
 * own sector so they never stack, at a distance inside the ring the doc describes.
 *
 * `random` is injected so the spread is testable; the caller passes `Math.random`.
 */
export function wrathPositions(
    player: Point,
    count: number,
    random: () => number,
): Point[] {
    const points: Point[] = [];
    const sector = (Math.PI * 2) / Math.max(1, count);

    for (let i = 0; i < count; i += 1) {
        // One per sector, jittered inside it, so three circles cannot collapse onto
        // the same spot and turn a dodge into a coin flip.
        const angle = sector * i + random() * sector;
        const distance =
            WRATH_MIN_DISTANCE + random() * (WRATH_MAX_DISTANCE - WRATH_MIN_DISTANCE);
        points.push({
            x: player.x + Math.cos(angle) * distance,
            y: player.y + Math.sin(angle) * distance,
        });
    }

    return points;
}