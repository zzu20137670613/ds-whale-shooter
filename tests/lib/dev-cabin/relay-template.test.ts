/**
 * tests/lib/dev-cabin/relay-template.test.ts
 * --------------------------------------------------------------------------
 * The shared template, held to the same contract as the live Worker.
 *
 * 第七世 is going to copy this file and deploy it. Everything she cannot debug from reading it -
 * which repository it writes to, who is allowed to call it, whether a token can leak - is pinned
 * here instead.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plain ESM file outside src/, no types
import template from '../../../art-source/dev-cabin/relay/worker.template.js';

const ORIGIN = 'https://galgame.example';
const ENV = {
    GITEE_TOKEN: 'token-abc',
    GITEE_REPO: 'zzu20137670613/ds-galgamePC',
    ALLOWED_ORIGINS: `https://galgame.example, http://localhost:5173`,
};

interface Captured {
    url: string;
    init: { method: string; headers: Record<string, string>; body: string };
}

function stubFetch(response: Partial<Response> = {}): Captured[] {
    const calls: Captured[] = [];
    vi.stubGlobal('fetch', (url: string, init: Captured['init']) => {
        calls.push({ url, init });
        return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ html_url: 'https://gitee.com/x/issues/1', ...response }),
        });
    });
    return calls;
}

const request = (payload: unknown, { origin = ORIGIN, method = 'POST' } = {}) => ({
    method,
    headers: { get: (name: string) => (name === 'Origin' ? origin : null) },
    json: () => Promise.resolve(payload),
});

afterEach(() => vi.unstubAllGlobals());

describe('who may call it', () => {
    it('answers the preflight for a listed origin', async () => {
        const res = await template.fetch(request(null, { method: 'OPTIONS' }), ENV);
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    });

    it('refuses an origin that is not listed, before Gitee is touched', async () => {
        const calls = stubFetch();
        const res = await template.fetch(
            request({ message: 'hi' }, { origin: 'https://evil.example' }),
            ENV,
        );
        expect(res.status).toBe(403);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        expect(calls).toHaveLength(0);
    });

    it('fails closed when no origin list is configured', async () => {
        // The deployed version shipped `*`; that is the mistake the template exists to fix.
        const calls = stubFetch();
        const res = await template.fetch(request({ message: 'hi' }), {
            GITEE_TOKEN: 't',
            GITEE_REPO: 'a/b',
        });
        expect(res.status).toBe(403);
        expect(calls).toHaveLength(0);
    });

    it('tolerates spaces in the origin list', async () => {
        stubFetch();
        const res = await template.fetch(
            request({ message: 'hi' }, { origin: 'http://localhost:5173' }),
            ENV,
        );
        expect(res.status).toBe(200);
    });
});

describe('what it posts to Gitee', () => {
    it('uses the owner-scoped route and the bare repository name', async () => {
        const calls = stubFetch();
        await template.fetch(request({ message: 'hello there' }), ENV);
        expect(calls[0].url).toBe('https://gitee.com/api/v5/repos/zzu20137670613/issues');
        const body = JSON.parse(calls[0].init.body);
        expect(body.repo).toBe('ds-galgamePC');
        expect(body.repo).not.toContain('/');
    });

    it('puts the token in the body, never in a header', async () => {
        const calls = stubFetch();
        await template.fetch(request({ message: 'hello there' }), ENV);
        const body = JSON.parse(calls[0].init.body);
        expect(body.access_token).toBe('token-abc');
        expect(calls[0].init.headers.Authorization).toBeUndefined();
    });

    it('never sends labels', async () => {
        const calls = stubFetch();
        await template.fetch(request({ message: 'hello there' }), ENV);
        expect(JSON.parse(calls[0].init.body).labels).toBeUndefined();
    });

    it('carries the message, handle and reply into the issue body', async () => {
        const calls = stubFetch();
        await template.fetch(
            request({ message: '想要一张地图', handle: '小鱼', reply: 'yu@example.com' }),
            ENV,
        );
        const body = JSON.parse(calls[0].init.body);
        expect(body.body).toContain('想要一张地图');
        expect(body.body).toContain('小鱼');
        expect(body.body).toContain('yu@example.com');
    });
});

describe('what it answers', () => {
    it('returns the issue url on success', async () => {
        stubFetch();
        const res = await template.fetch(request({ message: 'hello there' }), ENV);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, url: 'https://gitee.com/x/issues/1' });
    });

    it('rejects a one-character message', async () => {
        const calls = stubFetch();
        const res = await template.fetch(request({ message: ' ' }), ENV);
        expect(res.status).toBe(400);
        expect(calls).toHaveLength(0);
    });

    it('clamps an over-long message instead of rejecting it', async () => {
        const calls = stubFetch();
        await template.fetch(request({ message: 'x'.repeat(9000) }), ENV);
        const body = JSON.parse(calls[0].init.body);
        expect(body.body.length).toBeLessThan(9000);
    });

    it('does not leak the Gitee response when Gitee refuses', async () => {
        vi.stubGlobal('fetch', () =>
            Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }),
        );
        const res = await template.fetch(request({ message: 'hello there' }), ENV);
        expect(res.status).toBe(502);
        const payload = await res.json();
        expect(payload.error).toBe('gitee 401');
        expect(JSON.stringify(payload)).not.toContain('token-abc');
    });

    it('says so when the repository variable is missing', async () => {
        const calls = stubFetch();
        const res = await template.fetch(request({ message: 'hello there' }), {
            GITEE_TOKEN: 't',
            ALLOWED_ORIGINS: ORIGIN,
        });
        expect(res.status).toBe(500);
        expect(calls).toHaveLength(0);
    });

    it('rejects a method other than POST', async () => {
        const res = await template.fetch(request(null, { method: 'GET' }), ENV);
        expect(res.status).toBe(405);
    });

    it('rejects a body that is not json', async () => {
        const res = await template.fetch(
            {
                method: 'POST',
                headers: { get: () => ORIGIN },
                json: () => Promise.reject(new Error('nope')),
            },
            ENV,
        );
        expect(res.status).toBe(400);
    });
});
