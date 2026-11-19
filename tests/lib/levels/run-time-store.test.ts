/**
 * tests/lib/levels/run-time-store.test.ts
 * --------------------------------------------------------------------------
 * `recordLevelClear` 除了写那一笔，还要**返回整章累计**，因为结算页那行「用时」直接吃这个返回值。
 *
 * 主人 2026-11-16 的两条要求合起来看：
 *   `boss关结束的通关时间……拆成了4个图` → 四关加起来；
 *   而且读档直打末关也得能玩（那三关没记录时只算有的）。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from '@/store/game-store';

describe('recordLevelClear', () => {
    beforeEach(() => {
        useGameStore.setState({ levelClearMs: {} });
    });

    it('returns the running chapter total as each block clears', () => {
        const store = useGameStore.getState();
        expect(store.recordLevelClear('warhammer-redeem-1-chapel', 60_000)).toBe(60_000);
        expect(store.recordLevelClear('warhammer-redeem-2-warship', 90_000)).toBe(150_000);
        expect(store.recordLevelClear('warhammer-redeem-3-fireworks', 30_000)).toBe(180_000);
        expect(store.recordLevelClear('warhammer-redeem-4-first-meeting', 20_000)).toBe(200_000);
    });

    it('keeps the latest attempt rather than adding a replay on top', () => {
        const store = useGameStore.getState();
        store.recordLevelClear('warhammer-redeem-1-chapel', 60_000);
        // 重打一遍第一关：应当覆盖，不是 60s + 10s。
        expect(store.recordLevelClear('warhammer-redeem-1-chapel', 10_000)).toBe(10_000);
    });

    it('does not mix chapters', () => {
        const store = useGameStore.getState();
        store.recordLevelClear('dsh-atlantis-1-entrance', 999_000);
        expect(store.recordLevelClear('warhammer-redeem-1-chapel', 5_000)).toBe(5_000);
    });

    it('clamps nonsense to zero', () => {
        expect(useGameStore.getState().recordLevelClear('warhammer-redeem-1-chapel', -5)).toBe(0);
    });
});