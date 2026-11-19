/**
 * tests/lib/drops/auto-restore.test.ts
 * --------------------------------------------------------------------------
 * 自动补给：血/蓝掉到 30% 就喝碎片，补到 60% 停。
 *
 * 主人 2026-11-13：`改为血量掉落至<=30%时，自动使用生命碎片回复至>=60%，蓝量同理掉落至<=30%
 * 时，自动回复至>=60%（都是背包有血药蓝药的情况下），此机制给PC端也加上吧`。
 *
 * The trap this file exists for: a single "below the trigger" test cannot reach the target.
 * One 生命碎片 is worth 25 points, so the first drink from 30% lands around 40% - above the
 * trigger, below the target. Without hysteresis the rule stalls there forever.
 */

import { describe, expect, it } from 'vitest';

import {
    AUTO_RESTORE_INTERVAL_MS,
    AUTO_RESTORE_ITEMS,
    AUTO_RESTORE_TARGET_PCT,
    AUTO_RESTORE_TRIGGER_PCT,
    isBelowRestoreTrigger,
    nextRestoreArmed,
    reachedRestoreTarget,
    restoreShare,
    restoreSlotIndex,
} from '@/lib/drops/auto-restore';

const MAX_HP = 132;
const SHARD_HEAL = 25;
const MAX_SP = 228;
const FRAGMENT_SP = 60;

/** How many drinks, and where the bar lands, for one resource under the real rule. */
function settle(
    current: number,
    max: number,
    perDrink: number,
    room: number,
): { drinks: number; end: number; armed: boolean } {
    let armed = false;
    let value = current;
    let drinks = 0;
    for (let tick = 0; tick < 200 && value <= max; tick++) {
        armed = nextRestoreArmed(armed, value, max);
        if (!armed || room <= drinks) break;
        drinks += 1;
        value = Math.min(max, value + perDrink);
    }
    return { drinks, end: value, armed };
}

describe('the two lines', () => {
    it('are the owner\u2019s 30% and 60%', () => {
        expect(AUTO_RESTORE_TRIGGER_PCT).toBe(30);
        expect(AUTO_RESTORE_TARGET_PCT).toBe(60);
    });

    it('uses 生命碎片 for HP and 灵力碎片 for SP', () => {
        expect(AUTO_RESTORE_ITEMS.hp).toBe('hp-shard');
        expect(AUTO_RESTORE_ITEMS.sp).toBe('sp-fragment');
    });

    it('checks the interval is longer than a drink takes to land', () => {
        expect(AUTO_RESTORE_INTERVAL_MS).toBeGreaterThanOrEqual(300);
    });
});

describe('reading a bar', () => {
    it('reports the share, clamped', () => {
        expect(restoreShare(66, 132)).toBeCloseTo(0.5);
        expect(restoreShare(-5, 132)).toBe(0);
        expect(restoreShare(999, 132)).toBe(1);
        // Junk (a missing max) reads as healthy rather than as "drink everything".
        expect(restoreShare(10, 0)).toBe(1);
        expect(restoreShare(Number.NaN, 132)).toBe(1);
    });

    it('fires at or below 30, not only strictly below', () => {
        expect(isBelowRestoreTrigger(30, 100)).toBe(true);
        expect(isBelowRestoreTrigger(31, 100)).toBe(false);
    });

    it('counts 60 as done', () => {
        expect(reachedRestoreTarget(60, 100)).toBe(true);
        expect(reachedRestoreTarget(59, 100)).toBe(false);
    });
});

describe('hysteresis', () => {
    it('arms at the trigger and stays armed in the gap', () => {
        let armed = nextRestoreArmed(false, 20, 100); // 20% -> arm
        expect(armed).toBe(true);
        armed = nextRestoreArmed(armed, 45, 100); // 45% -> keep drinking
        expect(armed).toBe(true);
        armed = nextRestoreArmed(armed, 60, 100); // 60% -> done
        expect(armed).toBe(false);
    });

    it('never arms between the lines on its own', () => {
        expect(nextRestoreArmed(false, 45, 100)).toBe(false);
    });

    it('does not drink on a corpse', () => {
        expect(nextRestoreArmed(true, 0, 100)).toBe(false);
    });

    it('treats junk numbers as healthy', () => {
        expect(nextRestoreArmed(true, Number.NaN, 100)).toBe(false);
        expect(nextRestoreArmed(true, 50, 0)).toBe(false);
    });
});

describe('the round trip the owner asked for', () => {
    it('takes HP from 30% back to >=60%', () => {
        const start = Math.floor(MAX_HP * 0.3); // 39 HP
        const { drinks, end } = settle(start, MAX_HP, SHARD_HEAL, 9);
        expect(drinks).toBeGreaterThan(0);
        expect(end / MAX_HP).toBeGreaterThanOrEqual(0.6);
        // And it stops there instead of emptying the bag onto a full bar.
        expect(end).toBeLessThan(MAX_HP);
    });

    it('takes SP from 30% back to >=60%', () => {
        const start = Math.floor(MAX_SP * 0.3); // 68 SP
        const { drinks, end } = settle(start, MAX_SP, FRAGMENT_SP, 9);
        expect(drinks).toBeGreaterThan(0);
        // 68 + 60 is only 56%, so the rule keeps going until the bar is actually at 60%.
        expect(drinks).toBe(2);
        expect(end / MAX_SP).toBeGreaterThanOrEqual(0.6);
    });

    it('does nothing above the trigger', () => {
        const { drinks } = settle(Math.ceil(MAX_HP * 0.5), MAX_HP, SHARD_HEAL, 9);
        expect(drinks).toBe(0);
    });

    it('gives up when the bag is empty rather than locking up', () => {
        const { drinks } = settle(10, MAX_HP, SHARD_HEAL, 0);
        expect(drinks).toBe(0);
    });
});

describe('which slot to drink from', () => {
    it('finds the first matching stack', () => {
        const bag = [{ dropId: 'beach-drink' }, { dropId: 'hp-shard' }, { dropId: 'sp-fragment' }];
        expect(restoreSlotIndex(bag, 'hp')).toBe(1);
        expect(restoreSlotIndex(bag, 'sp')).toBe(2);
    });

    it('is -1 when that kind is absent, without borrowing the other potion', () => {
        expect(restoreSlotIndex([{ dropId: 'sp-fragment' }], 'hp')).toBe(-1);
        expect(restoreSlotIndex([], 'hp')).toBe(-1);
    });

    it('ignores the all-in-one items on purpose', () => {
        // 过载核心 / 海底特饮 heal both bars at once; they are the player's call, not the rule's.
        const bag = [{ dropId: 'overcharge-core' }, { dropId: 'beach-drink' }];
        expect(restoreSlotIndex(bag, 'hp')).toBe(-1);
        expect(restoreSlotIndex(bag, 'sp')).toBe(-1);
    });
});
