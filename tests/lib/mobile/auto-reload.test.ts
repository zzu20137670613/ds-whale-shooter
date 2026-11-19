// @vitest-environment happy-dom
/**
 * tests/lib/mobile/auto-reload.test.ts
 * --------------------------------------------------------------------------
 * `换弹功能在移动端做成自动化，脱战5s自动换弹` — the owner's rule, as arithmetic.
 */

import { describe, expect, it } from 'vitest';

import {
    MOBILE_AUTO_RELOAD_IDLE_MS,
    idleMsSince,
    markCombat,
    nextCombatClock,
    shouldAutoReload,
} from '@/lib/mobile/auto-reload';

const base = { lastCombatAt: 1000, now: 1000, ammo: 3, maxAmmo: 12, reloading: false };

describe('the idle window', () => {
    it('is five seconds', () => {
        expect(MOBILE_AUTO_RELOAD_IDLE_MS).toBe(5000);
    });

    it('does not count up before the clock exists', () => {
        expect(idleMsSince(1000, 900)).toBe(0);
    });

    it('measures forward time', () => {
        expect(idleMsSince(1000, 3500)).toBe(2500);
    });

    it('re-arms the clock on every combat tick', () => {
        expect(markCombat(4200)).toBe(4200);
    });
});

describe('when the magazine fills itself', () => {
    it('waits the full five seconds', () => {
        expect(shouldAutoReload({ ...base, now: 1000 + 4999 })).toBe(false);
        expect(shouldAutoReload({ ...base, now: 1000 + 5000 })).toBe(true);
    });

    it('leaves a full magazine alone', () => {
        expect(shouldAutoReload({ ...base, ammo: 12, now: 6000 })).toBe(false);
    });

    it('never interrupts a reload already in flight', () => {
        expect(shouldAutoReload({ ...base, reloading: true, now: 6000 })).toBe(false);
    });

    it('ignores melee weapons, which have no magazine', () => {
        expect(shouldAutoReload({ ...base, ammo: 0, maxAmmo: 1, now: 6000 })).toBe(false);
    });

    it('fires while she stands still with a half-empty clip', () => {
        expect(shouldAutoReload({ ...base, ammo: 6, maxAmmo: 12, now: 9000 })).toBe(true);
    });
});

describe('what counts as combat', () => {
    const quiet = { fired: false, hit: false, cast: false };

    it('restarts on a shot', () => {
        expect(nextCombatClock(1000, 4000, { ...quiet, fired: true })).toBe(4000);
    });

    it('restarts when she is hit', () => {
        expect(nextCombatClock(1000, 4000, { ...quiet, hit: true })).toBe(4000);
    });

    it('restarts on a skill cast', () => {
        expect(nextCombatClock(1000, 4000, { ...quiet, cast: true })).toBe(4000);
    });

    it('does NOT restart while she walks', () => {
        // `移动也算脱战` - there is no `moved` signal at all, so running laps leaves the clock
        // where it was and the magazine still fills.
        expect(nextCombatClock(1000, 4000, quiet)).toBe(1000);
        expect(nextCombatClock(1000, 9000, quiet)).toBe(1000);
    });

    it('therefore reloads after five quiet seconds of movement', () => {
        const walkingOnly = nextCombatClock(1000, 6000, quiet);
        expect(
            shouldAutoReload({
                lastCombatAt: walkingOnly,
                now: 6000,
                ammo: 4,
                maxAmmo: 12,
                reloading: false,
            }),
        ).toBe(true);
    });
});
