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

/**
 * Bullets are twice the player's size - §2 ① - and now travel at three quarters of the
 * gun's authored speed.
 *
 * They used to run at half, and the owner could stand still at 600px and never be hit:
 * `打出火箭弹了…现在这站着不动都打不到`. Half speed plus the 1500ms default lifetime put the
 * end of every shell's flight at ~630px, right where he was standing.
 */
export const BOSS_BULLET_SIZE_MULTIPLIER = 2;
export const BOSS_BULLET_SPEED_MULTIPLIER = 0.75;

/**
 * How long one of her shells stays alive, in ms.
 *
 * Three times the projectile default, so the range grows with the speed instead of the
 * shells dying a screen away. Speed x1.5 and life x3 together make her reach roughly 2800px -
 * the whole ruins circle - which is what a boss with a mortar should have.
 */
export const BOSS_BULLET_LIFE_MS = 4500;

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
// 1000 -> 2000: half the extra second goes to the blue warning and half to the red one,
// so a stacked barrage is actually dodgeable (owner, 2026-10-31).
export const WRATH_FUSE_MS = 2000;
/** Explosion radius of one circle, before entropy growth. */
/** 天谴轰炸's starting circle, in world px.
 *
 * 2.5x the first cut (64 -> 160), on the owner's call: `初始天谴轰炸的圈太小了，把现在的
 * 天谴轰炸直径*2.5`. Diameter follows the radius, so the circle now covers 320px across
 * before `entropyRadius` grows it further.
 */
// 320 was lethal: with one wrath after EVERY primary move the circles overlapped and the
// owner died to the stack (`天谴轰炸叠加直接炸死了`). Halved back to 160.
export const WRATH_BASE_RADIUS = 160;

/**
 * How long after a primary move 天谴轰炸 lands, in ms.
 *
 * Every round is a pair now, and 200ms makes them read as one combo rather than two
 * unrelated attacks the player can handle one at a time.
 */
export const WRATH_PAIR_DELAY_MS = 200;

/**
 * How many boss attack rounds pass between two 天谴轰炸 casts.
 *
 * Every round used to be a pair (`primary + wrath`). The owner, 2026-11-14, after playing the
 * boss levels on a phone: `把释放天谴轰炸的cd时间增加一倍`. Touch controls have no sprint, so
 * the player could never reposition between rounds and the circles kept arriving; firing on
 * every second round doubles the interval while keeping the combo read (the wrath still lands
 * 200ms after the primary it belongs to).
 */
export const WRATH_EVERY_N_ROUNDS = 2;

/**
 * Whether the round that just started earns a 天谴轰炸 after its primary.
 *
 * `round` is 1-based, so a fresh fight opens with a primary alone and the first wrath lands on
 * round two. A nonsense cadence (`0`, `NaN`) is treated as "every round" - a corrupt number
 * must not mute the attack entirely.
 */
export function wrathDue(round: number, every: number = WRATH_EVERY_N_ROUNDS): boolean {
    const cadence = Number.isFinite(every) ? Math.floor(every) : 1;
    const step = Math.max(1, cadence);
    if (!Number.isFinite(round) || round <= 0) return false;
    return round % step === 0;
}

/** How long the barrage waits before its second, identical ring. */
export const BARRAGE_SECOND_RING_DELAY_MS = 200;
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
export const BOSS_ATTACKS: Record<'triple-cannon' | 'melee' | 'barrage' | 'wrath', BossAttackSpec> =
    {
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
export function wrathPositions(player: Point, count: number, random: () => number): Point[] {
    const points: Point[] = [];
    const sector = (Math.PI * 2) / Math.max(1, count);

    for (let i = 0; i < count; i += 1) {
        // One per sector, jittered inside it, so three circles cannot collapse onto
        // the same spot and turn a dodge into a coin flip.
        const angle = sector * i + random() * sector;
        const distance = WRATH_MIN_DISTANCE + random() * (WRATH_MAX_DISTANCE - WRATH_MIN_DISTANCE);
        points.push({
            x: player.x + Math.cos(angle) * distance,
            y: player.y + Math.sin(angle) * distance,
        });
    }

    return points;
}
/**
 * Is the player close enough for her to swing rather than shoot?
 *
 * Takes a real world distance. The controller used to pass
 * `Math.hypot(dirToPlayer.x, dirToPlayer.y)` - and `dirTo` returns a UNIT vector, so that
 * number was always 1 and every attack came out melee (`lastAttack=melee` in the debug panel,
 * while the readout itself said `dist=663`). She swung a 96px hitbox into empty air and the
 * fight looked like a statue that could not be hurt.
 */
export function isBossMeleeRange(distance: number, reach: number = BOSS_MELEE_REACH): boolean {
    if (!Number.isFinite(distance)) return false;
    return distance <= reach;
}
