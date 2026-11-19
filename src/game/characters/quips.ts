/**
 * src/game/characters/quips.ts
 * --------------------------------------------------------------------------
 * 「每隔一分多钟，鲸鱼娘忽然说一句」—— 台词池在 `public/data/quips.yaml`，
 * 抽卡规则在 `lib/quips/pool.ts`（洗牌 + 记忆窗口），这里只管**什么时候说**。
 *
 * 主人 2026-11-18：`每过一分钟就让角色说句话`；定稿四条：只给鲸鱼娘、60～90 秒抖动、
 * 台词放 YAML、`只做"洗牌 + 记忆窗口"`、只在关卡内说。
 *
 * 为什么用场景 update 累加而不是 `setTimeout`：
 *   · 场景暂停（对话、漫画、过场视频、背包打开）时 update 不跑，计时自动停 —— 这正是想要的，
 *     不然会从结算画面底下冒出一句"去玩玩看嘛"。
 *   · 打断期间把累计清零，回来之后重新数一整轮，不会"攒够了一次性连珠炮"。
 */

import { fetchQuips } from '@/lib/quips/loader';
import {
    emptyQuipState,
    nextQuip,
    nextQuipDelayMs,
    type Quip,
    type QuipState,
} from '@/lib/quips/pool';
import { useGameStore } from '@/store/game-store';

/** 只有鲸鱼娘会说这些话（主人 2026-11-18：`只给鲸鱼娘`）。 */
export const QUIP_CHARACTER_ID = 'deepseek';

/** 第一次开口的等待：别和开场撞在一起。 */
export const QUIP_FIRST_DELAY_MS = 20_000;

/** 现在是不是"能说话"的状态。 */
export function canSpeakNow(): boolean {
    const s = useGameStore.getState();
    if (s.settlementOpen) return false;
    if (s.backpackOpen) return false;
    if (s.devCabinOpen) return false;
    // 漫画/信件/视频这类界面各自会 pause 场景，update 不跑，这里不重复判断。
    return !s.comicIntroLevelId;
}

export interface QuipTicker {
    update(deltaMs: number): void;
    destroy(): void;
}

/**
 * 建一个说话计时器。
 *
 * @param characterId 当前操控的角色 id —— 不是鲸鱼娘就整个不建。
 * @param isTavern    亭台是选人界面，不说话。
 * @param say         把一句话送出去（场景注入 `sayQuip`）。
 */
export function createQuipTicker(options: {
    characterId: string;
    isTavern: boolean;
    say: (text: string) => void;
    random?: () => number;
}): QuipTicker {
    const random = options.random ?? Math.random;
    const silent = options.isTavern || options.characterId !== QUIP_CHARACTER_ID;

    let pool: Quip[] = [];
    let state: QuipState = emptyQuipState();
    let pending = 0;
    let waited = 0;
    let destroyed = false;
    let loading: Promise<void> | null = null;

    if (!silent) {
        loading = fetchQuips().then((quips) => {
            if (destroyed) return;
            pool = quips;
            // 首句稍晚一点：开场先让玩家看清楚这是哪张图。
            pending = QUIP_FIRST_DELAY_MS;
        });
    }

    return {
        update(deltaMs: number): void {
            if (silent || destroyed || pool.length === 0) return;
            void loading;
            if (!canSpeakNow()) {
                // 被界面打断了：清零重数，别攒着一次性放出来。
                waited = 0;
                return;
            }
            waited += deltaMs;
            if (waited < pending) return;

            // 已经有提示在显示：让一下，2 秒后再试。
            // 覆盖掉"血上限 +100"那种正经提示是很糟的体验，而这句话本来也不急。
            if (useGameStore.getState().notice) {
                waited = Math.max(0, pending - 2_000);
                return;
            }

            const { quip, state: nextState } = nextQuip(pool, state, random);
            state = nextState;
            waited = 0;
            pending = nextQuipDelayMs(random);
            if (!quip) return;
            try {
                options.say(quip.text);
            } catch (error) {
                // 说一句失败不该影响打枪。
                console.warn('[quips] say failed', error);
            }
        },
        destroy(): void {
            destroyed = true;
        },
    };
}

/**
 * 把一句台词送出去 —— 走**顶部那条带边框的提示**，和「礁石上有杯深海特饮……」同一条通道。
 *
 * 主人 2026-11-18：`这些对话都是底下有框的，你新加的安利台词位置不对，也没底框，保持一致吧`。
 * 我原来用的是 `sayAbove`（头顶裸字），位置和样式都和玩家已经习惯的那个框不一致。
 * 他随后要求王座、果汁那些也一起收（`一起收`），所以现在**全部角色台词只有这一条通道**。
 */
export function sayQuip(text: string): void {
    useGameStore.getState().showNotice(text);
}