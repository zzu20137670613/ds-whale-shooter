/**
 * tests/lib/pet/lifetime.test.ts
 * --------------------------------------------------------------------------
 * "Resume only what we suspended."
 *
 * The failure this prevents is annoying rather than fatal: close the game and a
 * pet you had hidden yourself pops back onto your desktop. It is also invisible
 * to any single-function test, because it is about the *order* of two calls
 * across a session - hence this file.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PET_FALLBACK_BONUS_PERCENT, PET_PROTOCOL, suspendPet, resumePet } from '@/lib/pet/bridge';
import {
    beginPetSession,
    endPetSession,
    hasSuspendedPet,
    resetPetLifetime,
} from '@/lib/pet/lifetime';

const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response;

const PING = {
    ok: true,
    app: 'ds-pet-bridge',
    protocol: PET_PROTOCOL,
    version: '0.13.10',
    state: 'awake',
};
const levelAt = (level: number, bonusPercent: number, max = false) => ({
    ok: true,
    protocol: PET_PROTOCOL,
    version: '0.13.10',
    level,
    max,
    label: max ? 'MAX' : `Lv.${level}`,
    affinity: 0,
    bonusPercent,
});

/** Records every method+route, and answers ping/level. */
function recordingDeps(ping: unknown, level: unknown) {
    const calls: string[] = [];
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
        const route = input.split('?')[0].split('/').pop() ?? '';
        calls.push(`${init?.method ?? 'GET'} ${route}`);
        if (route === 'level') return json(level);
        if (route === 'ping') return json(ping);
        return json({ ok: true });
    });
    return { deps: { fetcher: fetcher as never }, calls };
}

beforeEach(() => resetPetLifetime());

describe('beginPetSession', () => {
    it('reads the tier, then hides the pet', async () => {
        const { deps, calls } = recordingDeps(PING, levelAt(7, 30));
        const bonus = await beginPetSession(deps);

        expect(bonus).toEqual({ percent: 30, source: 'pet', label: 'Lv.7', suspended: true });
        // The order is the contract: read first, hide second.
        expect(calls).toEqual(['GET ping', 'GET level', 'POST suspend']);
        expect(hasSuspendedPet()).toBe(true);
    });

    it('does not hide a pet older than 0.13.10 - it gives no tier anyway', async () => {
        const { deps, calls } = recordingDeps(PING, {});
        const bonus = await beginPetSession(deps);

        expect(bonus.source).toBe('fallback');
        expect(bonus.percent).toBe(PET_FALLBACK_BONUS_PERCENT);
        expect(calls).not.toContain('POST suspend');
        expect(hasSuspendedPet()).toBe(false);
    });

    it('applies the fallback when nothing is running, without throwing', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        });
        const bonus = await beginPetSession({ fetcher: fetcher as never });
        expect(bonus.percent).toBe(PET_FALLBACK_BONUS_PERCENT);
        expect(bonus.suspended).toBe(false);
    });

    it('keeps the buff even if the suspend call itself fails', async () => {
        const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
            if (init?.method === 'POST') return json({ ok: false });
            return json(input.includes('/level') ? levelAt(10, 50, true) : PING);
        });
        const bonus = await beginPetSession({ fetcher: fetcher as never });
        expect(bonus.percent).toBe(50);
        expect(bonus.suspended).toBe(false);
    });
});

describe('endPetSession', () => {
    it('resumes the pet we hid', async () => {
        const { deps, calls } = recordingDeps(PING, levelAt(10, 50, true));
        await beginPetSession(deps);
        const resumed = await endPetSession(deps);

        expect(resumed).toBe(true);
        expect(calls).toContain('POST resume');
        expect(hasSuspendedPet()).toBe(false);
    });

    it('does nothing when we never hid a pet', async () => {
        const { deps, calls } = recordingDeps(PING, {});
        await beginPetSession(deps); // old build: no suspend
        const resumed = await endPetSession(deps);

        expect(resumed).toBe(false);
        expect(calls).not.toContain('POST resume');
    });

    it('does not resume twice when the game unmounts twice', async () => {
        const { deps, calls } = recordingDeps(PING, levelAt(5, 20));
        await beginPetSession(deps);
        await endPetSession(deps);
        await endPetSession(deps); // e.g. pagehide then unload
        expect(calls.filter((c) => c === 'POST resume')).toHaveLength(1);
    });
});

describe('the raw calls', () => {
    it('POSTs, never GETs - her routes reject GET with 405', async () => {
        const fetcher = vi.fn(async () => json({ ok: true }));
        await suspendPet({ fetcher: fetcher as never });
        await resumePet({ fetcher: fetcher as never });
        const methods = (
            fetcher as unknown as { mock: { calls: [string, RequestInit?][] } }
        ).mock.calls.map((c) => c[1]?.method);
        expect(methods).toEqual(['POST', 'POST']);
    });

    it('reaches the documented routes', async () => {
        const seen: string[] = [];
        const fetcher = vi.fn(async (input: string) => {
            seen.push(input);
            return json({ ok: true });
        });
        await suspendPet({ fetcher: fetcher as never });
        await resumePet({ fetcher: fetcher as never });
        expect(seen).toEqual([
            'http://127.0.0.1:38930/__pet/suspend?app=ds-pet-bridge',
            'http://127.0.0.1:38930/__pet/resume?app=ds-pet-bridge',
        ]);
    });

    it('reports failure rather than throwing when the pet is gone', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('ECONNREFUSED');
        });
        expect(await suspendPet({ fetcher: fetcher as never })).toBe(false);
        expect(await resumePet({ fetcher: fetcher as never })).toBe(false);
    });
});
