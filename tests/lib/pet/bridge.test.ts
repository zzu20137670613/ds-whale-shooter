/**
 * tests/lib/pet/bridge.test.ts
 * --------------------------------------------------------------------------
 * The desktop pet is optional, and this file is the proof.
 *
 * Every branch below is a way the pet can fail to answer - not installed, an
 * older build without `/level`, a future protocol, a hung socket - and the game
 * has to keep booting and keep a sensible buff. 第七世's own recommendation:
 * the fallback should not punish people who were already playing.
 */

import { describe, expect, it, vi } from 'vitest';

import {
    PET_FALLBACK_BONUS_PERCENT,
    bonusMultiplier,
    probePet,
    readBonusPercent,
    resolvePetBonus,
} from '@/lib/pet/bridge';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response;

const PING = { ok: true, app: 'ds-pet-bridge', protocol: 1, version: '0.13.10', state: 'awake' };
const LEVEL = {
    ok: true,
    app: 'ds-pet-bridge',
    protocol: 1,
    version: '0.13.10',
    state: 'awake',
    level: 10,
    max: true,
    label: 'MAX',
    affinity: 10000,
    bonus: 0.5,
    bonusPercent: 50,
};

/** Answers ping and level with the given bodies. */
function deps(ping: unknown, level: unknown) {
    return {
        fetcher: vi.fn(async (input: string) =>
            input.includes('/level') ? json(level) : json(ping),
        ) as never,
    };
}

describe('probePet', () => {
    it('reads the level and bonus from a live pet', async () => {
        const probe = await probePet(deps(PING, LEVEL));
        expect(probe.ok).toBe(true);
        if (!probe.ok) return;
        expect(probe.version).toBe('0.13.10');
        expect(probe.level.level).toBe(10);
        expect(probe.level.max).toBe(true);
        expect(probe.level.label).toBe('MAX');
        expect(probe.level.bonusPercent).toBe(50);
    });

    it('reports absent when nothing is listening', async () => {
        const probe = await probePet({
            fetcher: vi.fn(async () => {
                throw new Error('ECONNREFUSED');
            }) as never,
        });
        expect(probe).toEqual({ ok: false, reason: 'absent' });
    });

    it('reports absent when the ping is not ok', async () => {
        expect(await probePet(deps({ ok: false }, LEVEL))).toEqual({ ok: false, reason: 'absent' });
    });

    it('reports absent for a protocol it does not speak', async () => {
        // Her server may add routes freely, but a different protocol number
        // means the numbers on the wire mean something else.
        const probe = await probePet(deps({ ...PING, protocol: 2 }, LEVEL));
        expect(probe).toEqual({ ok: false, reason: 'absent' });
    });

    it('reports no-level for a pet older than 0.13.10 (no /level route)', async () => {
        const probe = await probePet({
            fetcher: vi.fn(async (input: string) =>
                input.includes('/level') ? json({}, false) : json(PING),
            ) as never,
        });
        expect(probe).toEqual({ ok: false, reason: 'no-level' });
    });

    it('rejects a nonsense bonus instead of multiplying stats by NaN', async () => {
        const probe = await probePet(deps(PING, { ...LEVEL, bonusPercent: 'lots' }));
        expect(probe).toEqual({ ok: false, reason: 'no-level' });
    });

    it('copes with a level that answers with a different protocol', async () => {
        const probe = await probePet(deps(PING, { ...LEVEL, protocol: 2 }));
        expect(probe).toEqual({ ok: false, reason: 'no-level' });
    });
});

describe('readBonusPercent', () => {
    it('accepts the documented 10..50 range', () => {
        for (const v of [10, 20, 30, 40, 50]) expect(readBonusPercent(v)).toBe(v);
    });

    it('rejects anything outside 0..100 and any non-number', () => {
        for (const v of [-1, 101, 1e9, NaN, Infinity, null, '50', {}]) {
            expect(readBonusPercent(v)).toBeNull();
        }
    });
});

describe('resolvePetBonus', () => {
    it('uses the pet tier when the pet answers', async () => {
        const bonus = await resolvePetBonus(deps(PING, LEVEL));
        expect(bonus).toEqual({ percent: 50, source: 'pet', label: 'MAX' });
    });

    it('falls back to 20% when the pet is not there', async () => {
        const bonus = await resolvePetBonus({
            fetcher: vi.fn(async () => {
                throw new Error('no pet');
            }) as never,
        });
        expect(bonus.percent).toBe(PET_FALLBACK_BONUS_PERCENT);
        expect(bonus.source).toBe('fallback');
    });

    it('falls back for an older pet, and says so in the label', async () => {
        const bonus = await resolvePetBonus({
            fetcher: vi.fn(async (input: string) =>
                input.includes('/level') ? json({}, false) : json(PING),
            ) as never,
        });
        expect(bonus.percent).toBe(PET_FALLBACK_BONUS_PERCENT);
        expect(bonus.label).toContain('旧版本');
    });
});

describe('the fallback tier', () => {
    it('is 20% - the owner set the fallback himself', () => {
        expect(PET_FALLBACK_BONUS_PERCENT).toBe(20);
    });

    it('stays below a maxed pet, so upgrading her is still worth doing', () => {
        // 20% is deliberately well under MAX. Note it equals the Lv.5-6 tier and
        // sits *above* Lv.1-4: someone with no reachable pet gets more than
        // someone on a Lv.1 pet. That asymmetry is the owner's call, but it is
        // recorded here so nobody "tidies" the number up without deciding it.
        expect(PET_FALLBACK_BONUS_PERCENT).toBeLessThan(50);
        expect(PET_FALLBACK_BONUS_PERCENT).toBeGreaterThan(10);
    });
});

describe('bonusMultiplier', () => {
    it('turns a percentage into the stat multiplier', () => {
        expect(bonusMultiplier(10)).toBeCloseTo(1.1, 5);
        expect(bonusMultiplier(50)).toBeCloseTo(1.5, 5);
        expect(bonusMultiplier(0)).toBe(1);
    });
});
