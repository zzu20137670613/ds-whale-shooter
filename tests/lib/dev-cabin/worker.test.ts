/**
 * tests/lib/dev-cabin/worker.test.ts
 * --------------------------------------------------------------------------
 * The relay's request to Gitee, pinned.
 *
 * 第七世 deployed this Worker and hit `404 Not Found Project` on a real POST. The cause was
 * in the body: the call carried `repo: "zzu20137670613/ds-whale-shooter"`, and Gitee reads a
 * `repo` field as a bare repository name - a value with a slash resolves to nothing, and the
 * failure surfaces as a misleading 404 rather than a scope error.
 *
 * (The path was never the problem: probing both shapes without a token returns 401 for
 * `/repos/{owner}/{repo}/issues` and for `/repos/{owner}/issues`, while a bogus route returns
 * 404 - so both routes exist and 401 only means "not authenticated".)
 *
 * The working shape, which this test now locks in, is the one 第七世 verified live:
 *   POST https://gitee.com/api/v5/repos/{owner}/issues
 *   { access_token, repo: "<bare name>", title, body }
 *
 * `worker.js` lives outside `src/`, so this imports it by path instead of the `@` alias.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plain ESM file outside src/, no types
import worker from '../../../art-source/dev-cabin/relay/worker.js';

const ENV = {
    GITEE_TOKEN: 'token-abc',
    GITEE_REPO: 'zzu20137670613/ds-whale-shooter-PC',
};

interface Captured {
    url: string;
    init: { method: string; headers: Record<string, string>; body: string };
}

function stubFetch(): Captured[] {
    const calls: Captured[] = [];
    vi.stubGlobal('fetch', (url: string, init: Captured['init']) => {
        calls.push({ url, init });
        return Promise.resolve({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ html_url: 'https://gitee.com/x/issues/1' }),
        });
    });
    return calls;
}

function request(payload: unknown) {
    return {
        method: 'POST',
        json: () => Promise.resolve(payload),
    };
}

afterEach(() => vi.unstubAllGlobals());

describe('what the relay posts to Gitee', () => {
    it('calls the owner-scoped issue route', async () => {
        const calls = stubFetch();
        await worker.fetch(request({ message: 'hello there', handle: '鲸', reply: 'a@b' }), ENV);

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('https://gitee.com/api/v5/repos/zzu20137670613/issues');
    });

    it('sends the bare repository name, never owner/repo', async () => {
        const calls = stubFetch();
        await worker.fetch(request({ message: 'hello there' }), ENV);

        const body = JSON.parse(calls[0].init.body);
        expect(body.repo).toBe('ds-whale-shooter-PC');
        expect(body.repo).not.toContain('/');
    });

    it('carries the token in the body, the way Gitee wants it', async () => {
        const calls = stubFetch();
        await worker.fetch(request({ message: 'hello there' }), ENV);

        const body = JSON.parse(calls[0].init.body);
        expect(body.access_token).toBe('token-abc');
        expect(calls[0].init.headers.Authorization).toBeUndefined();
    });

    it('never sends a labels field - Gitee 400s on an unknown label', async () => {
        const calls = stubFetch();
        await worker.fetch(request({ message: 'hello there' }), ENV);

        expect(JSON.parse(calls[0].init.body)).not.toHaveProperty('labels');
    });

    it('names the issue with the message and the signature', async () => {
        const calls = stubFetch();
        await worker.fetch(request({ message: '海边亭台很好', handle: '主人' }), ENV);

        const body = JSON.parse(calls[0].init.body);
        expect(body.title).toContain('开发者小屋来信');
        expect(body.body).toContain('海边亭台很好');
        expect(body.body).toContain('主人');
    });

    it('refuses a two-character no-op and does not call Gitee at all', async () => {
        const calls = stubFetch();
        const res = await worker.fetch(request({ message: ' ' }), ENV);

        expect(calls).toHaveLength(0);
        expect(res.status).toBe(400);
    });
});