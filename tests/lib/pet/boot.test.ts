// @vitest-environment happy-dom
/**
 * tests/lib/pet/boot.test.ts
 * --------------------------------------------------------------------------
 * The boot module exists to survive being called twice.
 *
 * React StrictMode and Vite HMR both run mount effects twice. If that reached
 * the bridge, we would suspend the pet twice and then track a state we cannot
 * undo - so the memoised promise is the whole point of this file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installPetExitHooks, resetPetBridgeForTests, startPetBridge } from '@/lib/pet/boot';
import { PET_SUSPEND_GRACE_MS } from '@/lib/pet/bridge';
import { resetPetLifetime } from '@/lib/pet/lifetime';

const json = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

const PING = { ok: true, app: 'ds-pet-bridge', protocol: 1, version: '0.13.10', state: 'awake' };
const LEVEL = {
    ok: true,
    protocol: 1,
    version: '0.13.10',
    level: 8,
    max: false,
    label: 'Lv.8',
    affinity: 0,
    bonusPercent: 30,
};

function deps() {
    const routes: string[] = [];
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
        const route = input.split('?')[0].split('/').pop() ?? '';
        routes.push(`${init?.method ?? 'GET'} ${route}`);
        if (route === 'level') return json(LEVEL);
        if (route === 'ping') return json(PING);
        return json({ ok: true });
    });
    const onBonus = vi.fn();
    return { deps: { fetcher: fetcher as never, onBonus }, routes };
}

beforeEach(() => {
    resetPetBridgeForTests();
    resetPetLifetime();
});
afterEach(() => vi.restoreAllMocks());


/**
 * Move the clock past her 1.4s goodbye line.
 *
 * `suspend` starts a spoken line and her window hides when it ends; waking her inside that
 * window cuts it off, so `endPetSession` refuses to. A real player quits minutes later -
 * these tests quit in the same millisecond, so they have to say so.
 */
function skipHerGoodbyeLine(): void {
    const realNow = Date.now;
    const base = realNow();
    Date.now = () => base + PET_SUSPEND_GRACE_MS + 1;
    setTimeout(() => {
        Date.now = realNow;
    }, 0);
}

describe('startPetBridge', () => {
    it('reports the pet tier to the store', async () => {
        const { deps: d } = deps();
        const bonus = await startPetBridge(d);
        expect(bonus).toMatchObject({ percent: 30, source: 'pet', label: 'Lv.8' });
        expect(d.onBonus).toHaveBeenCalledTimes(1);
    });

    it('only talks to the pet once, however many times it is mounted', async () => {
        const { deps: d, routes } = deps();
        await Promise.all([startPetBridge(d), startPetBridge(d), startPetBridge(d)]);
        expect(routes.filter((r) => r === 'POST suspend')).toHaveLength(1);
        expect(d.onBonus).toHaveBeenCalledTimes(1);
    });
});

describe('installPetExitHooks', () => {
    it('resumes the pet when the page is hidden', async () => {
        const { deps: d, routes } = deps();
        await startPetBridge(d);
        const stop = installPetExitHooks(d);

        skipHerGoodbyeLine();
        window.dispatchEvent(new Event('pagehide'));
        await vi.waitFor(() => expect(routes).toContain('POST resume'));
        stop();
    });

    it('does not fire twice when both exit events arrive', async () => {
        const { deps: d, routes } = deps();
        await startPetBridge(d);
        const stop = installPetExitHooks(d);

        skipHerGoodbyeLine();
        window.dispatchEvent(new Event('pagehide'));
        window.dispatchEvent(new Event('beforeunload'));
        await vi.waitFor(() => expect(routes).toContain('POST resume'));
        expect(routes.filter((r) => r === 'POST resume')).toHaveLength(1);
        stop();
    });

    it('unsubscribes cleanly', async () => {
        const { deps: d, routes } = deps();
        await startPetBridge(d);
        const stop = installPetExitHooks(d);
        skipHerGoodbyeLine();
        stop(); // fires once on teardown
        await vi.waitFor(() => expect(routes).toContain('POST resume'));

        const count = routes.filter((r) => r === 'POST resume').length;
        window.dispatchEvent(new Event('pagehide'));
        expect(routes.filter((r) => r === 'POST resume')).toHaveLength(count);
    });
});
