/**
 * tests/lib/dev-cabin/mail.test.ts
 * --------------------------------------------------------------------------
 * The letter route table.
 *
 * The rule under test: a letter the player typed must never be destroyed by
 * infrastructure. A broken relay degrades to "open Gitee, press submit", and
 * that fallback has to fire on *every* kind of relay failure - not just a clean
 * 500, but a thrown fetch too (offline, DNS, CORS refusal).
 */

import { describe, expect, it, vi } from 'vitest';

import {
    LETTER_MAX,
    buildIssueUrl,
    letterBody,
    normaliseLetter,
    sendLetter,
    validateLetter,
} from '@/lib/dev-cabin/mail';

const REPO = 'owner/repo';
const letter = { handle: '小鱼', reply: 'yu@example.com', message: '小屋真好看' };

const ok = (body: unknown = { ok: true, url: 'https://gitee.com/x/y/issues/9' }) =>
    ({ ok: true, json: async () => body }) as unknown as Response;

function deps(overrides: Partial<Parameters<typeof sendLetter>[1]> = {}) {
    const opened: string[] = [];
    const fetched: string[] = [];
    const base = {
        relay: 'https://relay.example',
        repo: REPO,
        fetcher: vi.fn(async () => ok()) as never,
        open: (url: string) => {
            opened.push(url);
        },
        opened,
        fetched,
    };
    return { ...base, ...overrides };
}

describe('letter validation', () => {
    it('insists on a contact when the form promises to answer', () => {
        // The sponsor form's placeholder says 必填 (`作者会第一时间联系您`). A placeholder that
        // promises a reply while the validator shrugs is a lie the player only finds out about
        // by being ignored later.
        const rules = { requireHandle: true, handleLabel: '联系方式' };
        const errors = validateLetter(
            { handle: '', reply: '', message: '想要一张定制地图' },
            rules,
        );
        expect(errors.handle).toContain('联系方式');
        expect(
            validateLetter(
                { handle: '微信 abc123', reply: '', message: '想要一张定制地图' },
                rules,
            ),
        ).toEqual({});
    });

    it('accepts a letter with just a message', () => {
        expect(validateLetter({ handle: '', reply: '', message: '你好' })).toEqual({});
    });

    it('rejects an empty or one-character message as a mis-click', () => {
        expect(validateLetter({ handle: '', reply: '', message: '' }).message).toBeDefined();
        expect(validateLetter({ handle: '', reply: '', message: ' ' }).message).toBeDefined();
        expect(validateLetter({ handle: '', reply: '', message: '啊' }).message).toBeDefined();
    });

    it('rejects a reply address he could never answer', () => {
        expect(validateLetter({ ...letter, reply: '不是邮箱' }).reply).toBeDefined();
        expect(validateLetter({ ...letter, reply: 'a@b' }).reply).toBeDefined();
    });

    it('accepts either an email or a URL to write back to', () => {
        expect(validateLetter({ ...letter, reply: 'a@b.co' })).toEqual({});
        expect(validateLetter({ ...letter, reply: 'https://space.example/u/1' })).toEqual({});
    });

    it('clips to the same limits the relay enforces', () => {
        const long = normaliseLetter({
            handle: 'x'.repeat(100),
            reply: '',
            message: 'y'.repeat(9999),
        });
        expect(long.message).toHaveLength(LETTER_MAX);
        expect(long.handle).toHaveLength(40);
    });
});

describe('issue fallback', () => {
    it('pre-fills title and body on Gitee, encoded so a newline cannot break the URL', () => {
        // The board moved to Gitee when the GitHub account was suspended: the fallback has
        // to open Gitee's form, and Gitee names the fields `issue[title]` / `issue[body]`.
        const url = buildIssueUrl(REPO, { ...letter, message: '第一行\n第二行' });
        expect(url.startsWith(`https://gitee.com/${REPO}/issues/new?`)).toBe(true);
        const params = new URL(url).searchParams;
        expect(params.get('issue[title]')).toBe('开发者小屋来信');
        expect(params.get('issue[body]')).toContain('第一行\n第二行');
        expect(params.get('issue[body]')).toContain('yu@example.com');
    });

    it('keeps the signature even when anonymous', () => {
        const body = letterBody({ handle: '', reply: '', message: '匿名信' });
        expect(body).toContain('匿名信');
        expect(body).toContain('（没留名字）');
    });
});

describe('sendLetter route table', () => {
    it('posts to the relay when it answers', async () => {
        const d = deps();
        const out = await sendLetter(letter, d);
        expect(out).toEqual({ via: 'relay', url: 'https://gitee.com/x/y/issues/9' });
        expect(d.opened).toHaveLength(0);
    });

    it('falls back to the issue page when the relay is down', async () => {
        const d = deps({
            fetcher: vi.fn(async () => ({ ok: false, json: async () => ({}) }) as never) as never,
        });
        const out = await sendLetter(letter, d);
        expect(out.via).toBe('issue');
        expect(d.opened).toHaveLength(1);
        expect(d.opened[0]).toContain('/issues/new?');
    });

    it('falls back when the relay throws - offline is not a lost letter', async () => {
        const d = deps({
            fetcher: vi.fn(async () => {
                throw new Error('network down');
            }) as never,
        });
        const out = await sendLetter(letter, d);
        expect(out.via).toBe('issue');
    });

    it('falls back when the relay responds ok but refuses the letter', async () => {
        const d = deps({ fetcher: vi.fn(async () => ok({ ok: false, error: 'empty' })) as never });
        expect((await sendLetter(letter, d)).via).toBe('issue');
    });

    it('goes straight to the issue page when no relay is configured', async () => {
        const d = deps({ relay: '' });
        const out = await sendLetter(letter, d);
        expect(out.via).toBe('issue');
        expect(d.fetcher).not.toHaveBeenCalled();
    });

    it('refuses to send an invalid letter, without opening anything', async () => {
        const d = deps();
        const out = await sendLetter({ handle: '', reply: '', message: '' }, d);
        expect(out).toEqual({ via: 'failed', reason: 'invalid' });
        expect(d.opened).toHaveLength(0);
        expect(d.fetcher).not.toHaveBeenCalled();
    });
});
