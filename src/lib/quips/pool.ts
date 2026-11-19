/**
 * src/lib/quips/pool.ts
 * --------------------------------------------------------------------------
 * 关卡里那句"每隔一分多钟冒出来的一句话"该抽哪一句 —— **洗牌 + 记忆窗口**，不做稀有度。
 *
 * 主人 2026-11-18 定的四条：
 *   · 只给鲸鱼娘说；
 *   · 60～90 秒抖动；
 *   · 台词放 `public/data/quips.yaml`；
 *   · `只做"洗牌 + 记忆窗口"`（他明确不要抽卡的稀有度保底那套）。
 *
 * 所以这里的规则很简单，但两条都要有：
 *   1. **洗牌**：一轮之内不重复 —— 把剩下的打乱依次抽，抽完再洗。
 *   2. **记忆窗口**：最近 5 句不会被抽到。洗牌刚好把一句排到最前面时，它也不会立刻重复。
 *
 * 纯函数 + 显式随机源，好在测试里把"洗牌"和"窗口"分别固定住验证。
 */

/** 一句台词。 */
export interface Quip {
    id: string;
    /** 分类，只给人看：pet / galgame / shooter / meta。 */
    group: string;
    text: string;
}

/** 抽卡状态：本轮还没抽的、最近说过的那几句。 */
export interface QuipState {
    /** 本轮剩下的（已经按抽出的顺序排好，逐个 `shift`）。 */
    remaining: string[];
    /** 最近说过的，新的在前，最长 `memoryWindow`。 */
    recent: string[];
}

/** 记忆窗口：最近几句不再抽。 */
export const QUIP_MEMORY_WINDOW = 5;

/** 抖动区间：60～90 秒。 */
export const QUIP_DELAY_MIN_MS = 60_000;
export const QUIP_DELAY_MAX_MS = 90_000;

/** 空状态。 */
export function emptyQuipState(): QuipState {
    return { remaining: [], recent: [] };
}

/** 洗牌（Fisher–Yates），用传进来的随机源，测试里可固定。 */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
    }
    return out;
}

/**
 * 下一句该说哪一句。
 *
 * @param pool   全部台词
 * @param state  上一次的抽卡状态（首次传 `emptyQuipState()`）
 * @param random 0..1 的随机源
 * @returns 抽到的台词（池子为空时是 null）与新的状态
 */
export function nextQuip(
    pool: readonly Quip[],
    state: QuipState,
    random: () => number = Math.random,
): { quip: Quip | null; state: QuipState } {
    if (pool.length === 0) return { quip: null, state };

    const byId = new Map(pool.map((q) => [q.id, q]));
    let remaining = state.remaining.filter((id) => byId.has(id));
    const recent = [...state.recent];

    // 本轮抽完了就重新洗一副，并把最近说过的排到后面去 —— 洗完还要过一遍窗口，
    // 否则"刚好洗到最前面"的上一句会立刻重复。
    if (remaining.length === 0) {
        remaining = shuffle(
            pool.map((q) => q.id),
            random,
        );
        const window = new Set(recent.slice(0, QUIP_MEMORY_WINDOW));
        const fresh = remaining.filter((id) => !window.has(id));
        const blocked = remaining.filter((id) => window.has(id));
        // 池子比窗口还小时不能把嘴堵死：优先用没在窗口里的，实在没有就放行。
        remaining = [...fresh, ...blocked];
    }

    const id = remaining[0];
    const quip = byId.get(id) ?? null;
    remaining = remaining.slice(1);
    if (id) {
        recent.unshift(id);
        if (recent.length > QUIP_MEMORY_WINDOW) recent.length = QUIP_MEMORY_WINDOW;
    }
    return { quip, state: { remaining, recent } };
}

/** 下一次说话的间隔：60～90 秒之间均匀抖动。 */
export function nextQuipDelayMs(random: () => number = Math.random): number {
    const span = QUIP_DELAY_MAX_MS - QUIP_DELAY_MIN_MS;
    const clamped = Math.min(1, Math.max(0, random()));
    return Math.round(QUIP_DELAY_MIN_MS + span * clamped);
}