// @vitest-environment happy-dom
/**
 * tests/game/characters/quip-ticker.test.ts
 * --------------------------------------------------------------------------
 * 「隔一分多钟说一句」的时机控制 —— 抽卡规则在 `lib/quips/pool.ts` 里单独测过，
 * 这里只测"什么时候说、什么时候不说"。
 *
 * 主人 2026-11-18 的四条：只给鲸鱼娘 / 60～90 秒抖动 / 台词在 YAML / 只在关卡内。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQuipTicker, sayQuip } from '@/game/characters/quips';
import { useGameStore } from '@/store/game-store';

vi.mock('@/lib/quips/loader', () => ({
    fetchQuips: () =>
        Promise.resolve([
            { id: 'a', group: 'meta', text: '第一句' },
            { id: 'b', group: 'meta', text: '第二句' },
            { id: 'c', group: 'meta', text: '第三句' },
        ]),
}));

/** 让 loader 的 promise 结算。 */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the quip ticker', () => {
    beforeEach(() => {
        useGameStore.setState({
            settlementOpen: false,
            backpackOpen: false,
            devCabinOpen: false,
            comicIntroLevelId: null,
            notice: null,
        });
    });

    it('says nothing on the tavern screen', async () => {
        const say = vi.fn();
        const ticker = createQuipTicker({ characterId: 'deepseek', isTavern: true, say });
        await flush();
        ticker.update(10 * 60_000);
        expect(say).not.toHaveBeenCalled();
        ticker.destroy();
    });

    it('says nothing when someone else is being played', async () => {
        // 主人：`只给鲸鱼娘` —— 别的角色说"桌面上那个我"会很怪。
        const say = vi.fn();
        const ticker = createQuipTicker({ characterId: 'claude', isTavern: false, say });
        await flush();
        ticker.update(10 * 60_000);
        expect(say).not.toHaveBeenCalled();
        ticker.destroy();
    });

    it('waits about a minute before the first line, then keeps going', async () => {
        const say = vi.fn();
        const ticker = createQuipTicker({ characterId: 'deepseek', isTavern: false, say });
        await flush();

        // 首句 20 秒后。
        ticker.update(19_000);
        expect(say).not.toHaveBeenCalled();
        ticker.update(2_000);
        expect(say).toHaveBeenCalledTimes(1);

        // 之后每 60～90 秒一句。
        ticker.update(45_000);
        expect(say).toHaveBeenCalledTimes(1);
        ticker.update(46_000);
        expect(say).toHaveBeenCalledTimes(2);
        ticker.destroy();
    });

    it('never runs the counters while an overlay owns the screen', async () => {
        const say = vi.fn();
        const ticker = createQuipTicker({ characterId: 'deepseek', isTavern: false, say });
        await flush();

        useGameStore.setState({ backpackOpen: true });
        // 开着背包站十分钟，一句都不会说，也不会攒着出来。
        ticker.update(10 * 60_000);
        expect(say).not.toHaveBeenCalled();

        useGameStore.setState({ backpackOpen: false });
        ticker.update(1_000);
        expect(say).not.toHaveBeenCalled();
        ticker.destroy();
    });

    it('does not talk over a notice that is already on screen', async () => {
        // 「血上限 +100」那种正经提示被一句闲聊覆盖掉，是很糟的体验。
        const say = vi.fn();
        const ticker = createQuipTicker({ characterId: 'deepseek', isTavern: false, say });
        await flush();
        ticker.update(60_000);
        say.mockClear();

        useGameStore.setState({ notice: '血上限 +100、蓝上限 +100（带着就生效）' });
        ticker.update(200_000);
        expect(say).not.toHaveBeenCalled();

        // 提示消失后 2 秒，那句话就出来了。
        useGameStore.setState({ notice: null });
        ticker.update(60_000);
        expect(say).toHaveBeenCalledTimes(1);
        ticker.destroy();
    });

    it('shows the line in the framed notice box, like every other line', () => {
        // 主人 2026-11-18：`这些对话都是底下有框的……保持一致吧`。
        sayQuip('测试一句');
        expect(useGameStore.getState().notice).toBe('测试一句');
    });

    it('survives a say that throws', async () => {
        const say = vi.fn(() => {
            throw new Error('boom');
        });
        const ticker = createQuipTicker({ characterId: 'deepseek', isTavern: false, say });
        await flush();
        expect(() => ticker.update(60_000)).not.toThrow();
        ticker.destroy();
    });
});