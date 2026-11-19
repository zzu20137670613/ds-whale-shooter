/**
 * src/lib/bosses/phases.ts
 * --------------------------------------------------------------------------
 * Claude's five phases, as data.
 *
 * The design is a descent, not a bigger health bar: she starts as the god who ends
 * the world and is dragged back down to a person. Each phase is therefore a fresh
 * health bar at a different scale, with its own attack rhythm — and the shortest gap
 * sits at phase 2, which is the peak of the fight, not the last phase.
 *
 * Numbers come from `boss-神Claude-机制总表.md` §1.1, which the owner locked. The
 * multipliers are relative to phase 1's authored stats in `claude.yaml`, so tuning one
 * base number moves all five phases together.
 */

export type BossPhaseName = 'annihilation' | 'deity' | 'demigod' | 'half-mortal' | 'claude';

export interface BossPhase {
    /** 1..5, in the order she is fought. */
    id: number;
    name: BossPhaseName;
    /** Health for this phase, as a multiple of the authored HP. */
    hpScale: number;
    /** Movement speed multiple. */
    moveScale: number;
    /**
     * Flat speed added **after** the multiplier, in `moveSpeed` units.
     *
     * 主人 2026-11-15：`bossClaude的初始移速+1` —— 只给第一形态加，别的形态维持原样，
     * 所以是个绝对值而不是又一个倍率（倍率会把 1.5 倍的第二形态一起放大）。
     */
    moveBonus?: number;
    /** Damage multiple for every attack she uses in this phase. */
    damageScale: number;
    /**
     * Bullet lifetime multiple — i.e. how far her shells fly.
     *
     * 主人 2026-11-16（手机上实测）：`boss战中阶段34的移速削弱去掉，并且攻击距离翻倍`，
     * 追问后确认「攻击距离」指的是**炮弹飞行距离**，所以翻的是子弹存活时间，不是近战触发距离。
     */
    bulletLifeScale?: number;
    /** Breathing room after each attack, in ms. Shortest at phase 2, on purpose. */
    gapMs: number;
    /** Only 神·Claude calls down 天谴轰炸. */
    allowsWrath: boolean;
    /**
     * How tall she is drawn in this phase, in screen pixels.
     *
     * The owner's ladder, restated after he played it: `前四阶段我们约定的都是比正常人物
     * 要高半头大一圈的，只有最后一个阶段才恢复正常Claude大小`.
     *
     * The player draws at 173px. Two rounds of tuning got here:
     *   198 -> 216 (still too close) -> 281, which is 216 x 1.3 as he asked
     *   (`将前三阶段的Claude再放大30%`). Phase four is 196 -> 235 (+20%), and the last
     *   form is exactly the player's 173px: she is a person again.
     */
    spritePx: number;
}

/**
 * The ladder. Phase 2 is deliberately the hardest: 150% stats AND a one-second gap.
 * From there it unwinds — the last phase is the slowest and least aggressive of all,
 * because by then it is an ending, not a gauntlet.
 */
/**
 * How long 灭世·Claude lies down between her first and second bars, in ms.
 *
 * The owner asked for a two-second beat (`在灭世·Claude与神·Claude之间增加两秒停顿`), then
 * watched a build where the fall never played at all and asked for three seconds with the
 * fall itself slowed down: `把2秒改成3秒，让倒下的动作放慢`.
 *
 * The fall is the whole pause now, not an addition to `BOSS_PHASE_TRANSITION_MS` - otherwise
 * 神·Claude waits four seconds while the body is already gone.
 */
export const BOSS_FALL_MS = 3000;

/**
 * Plate colours per phase, so the prefix can be read at a glance.
 *
 * Owner: `给前缀（灭世用黑色，神用红色，半神用蓝色，半神半人用绿色）都增加亮色，够惹眼`.
 * Black needs an outline to exist on a dark floor, so each colour comes with its own stroke.
 */
export const BOSS_PHASE_NAME_COLOURS: readonly { fill: string; stroke: string }[] = [
    { fill: '#111111', stroke: '#f5f5f4' }, // 灭世 - black on a pale halo
    { fill: '#ff2d2d', stroke: '#1c1917' }, // 神 - red
    { fill: '#38bdf8', stroke: '#1c1917' }, // 半神 - blue
    { fill: '#22c55e', stroke: '#1c1917' }, // 半神半人 - green
    { fill: '#f0abfc', stroke: '#1c1917' }, // 克劳德 - lilac
];

/** The colour pair for a phase index, clamped like `phaseAt`. */
export function bossPhaseNameColour(phaseIndex: number): { fill: string; stroke: string } {
    const clamped = Math.min(
        Math.max(Math.floor(phaseIndex), 0),
        BOSS_PHASE_NAME_COLOURS.length - 1,
    );
    return BOSS_PHASE_NAME_COLOURS[clamped]!;
}

/** Boss plates are two sizes up from a monster's. */
export const BOSS_NAME_FONT_PX = 15;

export const BOSS_PHASES: readonly BossPhase[] = [
    {
        id: 1,
        name: 'annihilation',
        hpScale: 2,
        moveScale: 1,
        // 主人 2026-11-15：`bossClaude的初始移速+1`。
        moveBonus: 1,
        damageScale: 1,
        gapMs: 750,
        allowsWrath: true,
        spritePx: 281,
    },
    {
        id: 2,
        name: 'deity',
        hpScale: 3.6,
        moveScale: 1.5,
        damageScale: 1.8,
        gapMs: 500,
        allowsWrath: true,
        spritePx: 281,
    },
    {
        id: 3,
        name: 'demigod',
        hpScale: 1.6,
        // 主人 2026-11-16：`阶段34的移速削弱去掉` —— 原来是 0.8，走起来拖。
        moveScale: 1,
        damageScale: 0.8,
        // 射程 ×2（子弹存活时间翻倍）。
        bulletLifeScale: 2,
        gapMs: 1000,
        // 主人 2026-11-16：`将阶段③的攻击方式由3种改为两种：三连击+顺时针，
        // 将天谴轰炸去掉`。allowsWrath 一关，天谴连"每两轮追加一次"都不会再排。
        allowsWrath: false,
        spritePx: 281,
    },
    {
        id: 4,
        name: 'half-mortal',
        hpScale: 0.5,
        // 主人 2026-11-16：`阶段34的移速削弱去掉` —— 原来是 0.5，几乎是挪。
        moveScale: 1,
        damageScale: 0.5,
        bulletLifeScale: 2,
        gapMs: 1000,
        // 阶段④保留天谴轰炸（攻击池里去掉顺时针，见 attacksForPhase）。
        allowsWrath: true,
        spritePx: 235,
    },
    // 第五阶段 2026-11-11 砍掉：主人要把四阶段正好对上拆开后的四块地图
    // （`boss战5阶段把最后一阶段去掉吧，只保留前四阶段，正好对应4个地图`）。
    // 前四阶段数值一个没动，第四阶段现在就是最终形态。
] as const;

/** Clamp into the ladder, so a corrupt counter can never index off the end. */
/**
 * 关卡打哪一阶段（0 起的下标）。
 *
 * 主人 2026-11-12：`四关匹配 boss 4 阶段，最后一个阶段取消，实测发现都在第一关，没有分到 4 关里`。
 * 地图拆开后每关只打一阶段，`level.bossPhase`（1 起）就是这一关的编号；不写就当第一关。
 */
export function bossStartPhaseIndex(levelPhase: number | undefined): number {
    if (typeof levelPhase !== 'number' || !Number.isFinite(levelPhase)) return 0;
    const index = Math.floor(levelPhase) - 1;
    return Math.min(Math.max(index, 0), BOSS_PHASES.length - 1);
}

/**
 * 清掉这一条血是不是整场结束了。
 *
 * 一关只打一阶段，所以它一开始的那一阶段就是最后一阶段：清空即死，而不是接着变成下一种形态
 * （那正是「都在第一关」的 bug —— 第一关把四种形态全打了一遍）。
 */
export function bossPhaseIsFinal(levelPhase: number | undefined, clearedIndex: number): boolean {
    // 没写 `bossPhase` 的关卡保持旧语义：打完整条阶梯，最后一条才致命。
    if (typeof levelPhase !== 'number' || !Number.isFinite(levelPhase)) {
        return clearedIndex >= BOSS_PHASES.length - 1;
    }
    return clearedIndex >= bossStartPhaseIndex(levelPhase);
}

/**
 * 这一关打完是不是该进结算（真正的结局）。
 *
 * 主人 2026-11-12：`现在打完灭世 Claude 直接进结算了`。四块地图是一条链（1→2→3→4），
 * 前三关杀掉对应形态只是清关，走普通流程开传送阵去下一关；只有第四关（半神半人）才是结局。
 * 没写 `bossPhase` 的老用法保持原样：boss 一死就结算。
 */
export function bossSettlementDue(levelPhase: number | undefined): boolean {
    if (typeof levelPhase !== 'number' || !Number.isFinite(levelPhase)) return true;
    return bossStartPhaseIndex(levelPhase) >= BOSS_PHASES.length - 1;
}

export function phaseAt(index: number): BossPhase {
    const clamped = Math.min(Math.max(Math.floor(index), 0), BOSS_PHASES.length - 1);
    return BOSS_PHASES[clamped];
}

/** The phase after this one, or null when the fight is over. */
export function nextPhase(index: number): BossPhase | null {
    return index + 1 < BOSS_PHASES.length ? BOSS_PHASES[index + 1] : null;
}

/** Everything a phase scales, applied to the authored numbers. */
export interface BossStats {
    hp: number;
    moveSpeed: number;
    damage: number;
}

export function scaleForPhase(base: BossStats, phase: BossPhase): BossStats {
    return {
        // Health is rounded up: a half-phase must never round to 0 HP.
        hp: Math.max(1, Math.ceil(base.hp * phase.hpScale)),
        moveSpeed: base.moveSpeed * phase.moveScale,
        damage: Math.max(1, Math.round(base.damage * phase.damageScale)),
    };
}

/**
 * Wrath bomb count for a phase: 3 circles, or 5 once she is at or below half health.
 *
 * Only 神·Claude calls it at all, so every other phase answers 0 regardless of health.
 */
export function wrathCircleCount(phase: BossPhase, hpFraction: number): number {
    if (!phase.allowsWrath) return 0;
    return hpFraction <= 0.5 ? 5 : 3;
}

/**
 * Which attacks a phase may use, by id.
 *
 * The design table lists four attacks and gates exactly one of them: `④` 天谴轰炸 is
 * 神·Claude's alone. The other three are hers in every phase — the descent changes how
 * hard and how often she swings, not what she knows how to do.
 */
export type BossAttackId = 'triple-cannon' | 'melee' | 'barrage' | 'wrath';

export function attacksForPhase(phase: BossPhase): BossAttackId[] {
    // `wrath` is deliberately NOT in this pool: since the owner's 2026-10-31 change every
    // round is `primary + 天谴轰炸`, so wrath is appended by the scheduler, never rolled.
    //
    // 主人 2026-11-16，手机上实测后把后两阶段的招式各砍一种：
    //   阶段③：三连击 + 顺时针（天谴轰炸去掉，见 `allowsWrath`）
    //   阶段④：三连击 + 天谴轰炸（顺时针去掉）
    // 顺时针 = `barrage`，三连击 = `triple-cannon`，天谴 = `wrath`。
    if (phase.id === 3) return ['triple-cannon', 'barrage'];
    if (phase.id === 4) return ['triple-cannon'];
    return ['triple-cannon', 'melee', 'barrage'];
}

/**
 * Pick the next attack, honouring the owner's anti-frustration rules:
 *
 *   1. never the same attack twice in a row;
 *   2. `③` barrage and `④` wrath never overlap — which here means: after a barrage,
 *      never wrath; after wrath, never a barrage.
 *
 * `random` is injected so the choice is testable without stubbing Math.random.
 */
export function pickNextAttack(
    phase: BossPhase,
    previous: BossAttackId | null,
    random: () => number,
): BossAttackId {
    const pool = attacksForPhase(phase).filter((attack) => {
        if (attack === previous) return false;
        const crossesBarrageWrath =
            (attack === 'wrath' && previous === 'barrage') ||
            (attack === 'barrage' && previous === 'wrath');
        return !crossesBarrageWrath;
    });

    // A phase with one attack would otherwise deadlock on rule 1.
    const effective = pool.length > 0 ? pool : attacksForPhase(phase);
    const index = Math.min(Math.floor(random() * effective.length), effective.length - 1);
    return effective[index];
}

/**
 * The entropy ramp: every wrath wave multiplies the explosion radius by 1.05, and the
 * growth RESETS per phase — the doc is explicit that each phase starts clean, so a
 * long phase 2 cannot make phase 3 impossible before it begins.
 */
export const ENTROPY_GROWTH_PER_WAVE = 1.05;

export function entropyRadius(baseRadius: number, waves: number): number {
    return baseRadius * Math.pow(ENTROPY_GROWTH_PER_WAVE, Math.max(0, Math.floor(waves)));
}
// ─── The health lock ─────────────────────────────────────────────────────
//
// Bosses are where a modified number hurts most: a save edited, a weapon tuning
// pass, a debug key, and the five-phase descent becomes a one-frame death. So a
// single hit may never take more than this fraction of the CURRENT phase's health,
// which turns "instantly dead" into "at least ten hits" no matter what the numbers
// upstream say.

export const BOSS_MAX_HIT_FRACTION = 0.1;

/**
 * Cap one hit against a phase's health pool.
 *
 * The cap is a fraction of the phase maximum, not of what is left, so a nearly-dead
 * boss still dies to a normal hit instead of becoming immortal at 1 HP.
 */
export function clampBossDamage(damage: number, phaseMaxHp: number): number {
    const cap = Math.max(1, Math.ceil(phaseMaxHp * BOSS_MAX_HIT_FRACTION));
    return Math.min(Math.max(0, damage), cap);
}

/**
 * Apply a hit, with the lock in force.
 *
 * Returns the new HP and whether this killed her FOR THIS PHASE - the caller then
 * either advances the ladder or ends the fight.
 */
export function applyBossHit(
    hp: number,
    damage: number,
    phaseMaxHp: number,
): { hp: number; died: boolean } {
    const taken = clampBossDamage(damage, phaseMaxHp);
    const left = Math.max(0, hp - taken);
    return { hp: left, died: left <= 0 };
}

/** On-screen sprite height for a phase, in px. */
export function spriteHeightForPhase(phase: BossPhase): number {
    return phase.spritePx;
}

/**
 * What the name plate says in each phase.
 *
 * The owner, twice: `开始名字叫做灭世·Claude，然后神·Claude…这些机制全都没有` and
 * `还是Claude`. The ladder had the numbers, never the titles - the plate showed plain
 * 克劳德 for the whole fight, so the descent was invisible.
 */
export const BOSS_PHASE_TITLES: Record<BossPhaseName, { en: string; zh: string }> = {
    annihilation: { en: 'World-Ender', zh: '灭世' },
    deity: { en: 'Deity', zh: '神' },
    demigod: { en: 'Demigod', zh: '半神' },
    'half-mortal': { en: 'Half-Mortal', zh: '半神半人' },
    // Her last form keeps the English name on purpose. The owner:
    // `最终的boss关第五阶段Claude就叫Claude，不要叫克劳德`.
    claude: { en: 'Claude', zh: 'Claude' },
};

/** `灭世·克劳德` / `World-Ender Claude` - the plate for a given phase. */
export function bossPhaseTitle(
    phaseIndex: number,
    baseName: string,
    locale: 'zh' | 'en' = 'zh',
): string {
    const phase = phaseAt(phaseIndex);
    const title = BOSS_PHASE_TITLES[phase.name];
    // The final form is not `·`-joined with a title, and it does not inherit the Chinese
    // spelling of the base name either: it is simply "Claude".
    if (phase.name === 'claude') return title[locale];
    // Chinese joins with the interpunct; English wants a space.
    return locale === 'zh' ? `${title.zh}·${baseName}` : `${title.en} ${baseName}`;
}

/**
 * How much of the LAST form's bar has to go before the fight ends.
 *
 * The owner: `最后一个阶段的Claude并没有触发半血直接结算，而是血条打开了才结算的`. Her last
 * form is a person, not a monster - the fight is over the moment she is beaten, not when
 * she is emptied. Half a bar is the agreement; every earlier phase still has to be emptied.
 */
export const FINAL_PHASE_END_FRACTION = 0.5;

/** The HP line at which this phase ends: 0 for phases 1-4, half the bar for the last one. */
export function phaseEndHp(phaseIndex: number, phaseMaxHp: number, phaseCount: number): number {
    return phaseIndex >= phaseCount - 1 ? phaseMaxHp * FINAL_PHASE_END_FRACTION : 0;
}

/**
 * How the pause between 灭世·Claude and 神·Claude is staged.
 *
 * Keyed on what the sheet actually carries, because keying it on `death` alone shipped a boss
 * with no death track: `claude.yaml` animates idle / walk / run / dodge, so neither the death
 * nor the turn branch ran, and the two forms swapped in a single frame
 * (`那3秒倒地动作没了，直接无缝切换了`).
 *
 * `fade` is the honest last resort: no art to fall with, so the beat is a fade out and back in.
 * The pause itself is `BOSS_FALL_MS` either way - it is a property of the phase change.
 */
export type BossFallPlan = 'death' | 'turn' | 'fade';

export function bossFallPlan(tracks: { hasDeath: boolean; hasTurn: boolean }): BossFallPlan {
    if (tracks.hasDeath) return 'death';
    if (tracks.hasTurn) return 'turn';
    return 'fade';
}

/**
 * Alpha for the no-art fall beat, as a function of how far through the pause we are (0..1).
 *
 * A tween was the obvious way to do this and it was not enough: the boss's sprite has other
 * writers, so the fade could be overridden frame by frame and the beat read as a jump-cut. Pure
 * and per-frame, this cannot be lost.
 *
 * Shape: fade out over the first 40%, hold invisible for 20%, fade back in over the last 40%.
 */
export function bossFallAlpha(progress: number): number {
    const p = Math.max(0, Math.min(1, progress));
    if (p <= 0.4) return 1 - p / 0.4;
    if (p < 0.6) return 0;
    return (p - 0.6) / 0.4;
}

/**
 * How far she tips over during the no-art fall beat, in degrees (0..80).
 *
 * The boss sheet's `death` track is frames 12-15 of the CROUCH row - the same frames as `cast`.
 * Playing it slowly reads as "she stands there breathing", which is why the owner keeps saying the
 * fall is missing (`那3秒倒地动作没了`). There is no fall pose in the art at all, so the beat is
 * made legible by tipping the sprite over while the crouch plays: a body going down reads even
 * when the frames do not.
 *
 * Replace both this and `bossFallAlpha` with a real `death` row of art when there is one.
 */
export function bossFallTilt(progress: number): number {
    const p = Math.max(0, Math.min(1, progress));
    // Most of the tip happens in the first half - she falls fast, then lies there.
    const t = Math.min(1, p / 0.55);
    // Square root, not square: a square eases in so slowly that a third of the way through the
    // beat she has barely moved, which is the "she just stands there" read we are fixing.
    return 80 * Math.sqrt(t);
}
