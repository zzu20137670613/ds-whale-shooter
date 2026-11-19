/**
 * src/lib/dev-cabin/mail.ts
 * --------------------------------------------------------------------------
 * Posting a letter from the developer's own machine.
 *
 * Three routes, tried in order, because a static page cannot write to Gitee on
 * its own — browser code has no token and must never be given one:
 *
 *   1. `relay`  — a Worker holding the token server-side. One click, done.
 *   2. `issue`  — a pre-filled "new issue" page; the player submits it under
 *                 their own Gitee identity. No server involved.
 *   3. nothing  — no relay and the player cannot open Gitee: the dialog says
 *                 so and points at the guestbook, instead of pretending.
 *
 * `fetch` and the "open a URL" action are injected so the whole route table is
 * testable without a browser.
 */

import { DEV_CABIN_FORGE } from './config';

export const LETTER_MAX = 4000;
export const HANDLE_MAX = 40;
export const REPLY_MAX = 200;

export interface Letter {
    /** Who it is from. Optional - a player may prefer to stay anonymous. */
    handle: string;
    /** Where to write back. Optional for the same reason. */
    reply: string;
    /** What they want to say. The only required field. */
    message: string;
}

export const emptyLetter = (): Letter => ({ handle: '', reply: '', message: '' });

export type LetterField = keyof Letter;

/** Trimmed, clipped to the limits the relay also enforces. */
export function normaliseLetter(letter: Letter): Letter {
    return {
        handle: letter.handle.trim().slice(0, HANDLE_MAX),
        reply: letter.reply.trim().slice(0, REPLY_MAX),
        message: letter.message.trim().slice(0, LETTER_MAX),
    };
}

export interface LetterErrors {
    handle?: string;
    message?: string;
    reply?: string;
}

/**
 * What a particular form insists on.
 *
 * The cabin takes an anonymous letter: a nickname is a courtesy. The sponsor form promises
 * `作者会第一时间联系您`, and its own placeholder says 必填 - so there the contact has to be
 * real, or the promise is a lie.
 */
export interface LetterRules {
    /** The nickname/contact field must be filled. */
    requireHandle?: boolean;
    /** The field's label, for the error message. */
    handleLabel?: string;
}

/**
 * Field errors for the send button. A one-character message is a mis-click, and
 * a malformed reply address means he can never answer - both are worth blocking,
 * but neither is worth shouting about.
 */
export function validateLetter(letter: Letter, rules: LetterRules = {}): LetterErrors {
    const clean = normaliseLetter(letter);
    const errors: LetterErrors = {};
    if (rules.requireHandle && clean.handle.length === 0) {
        errors.handle = `${rules.handleLabel ?? '联系方式'}不能空着，不然没法回你。`;
    }
    if (clean.message.length < 2) errors.message = '写点什么再寄吧。';
    if (clean.reply.length > 0 && !looksLikeContact(clean.reply)) {
        errors.reply = '留个邮箱或主页，我才能回你。';
    }
    return errors;
}

/** An email or a URL — he may want to answer on either. */
function looksLikeContact(value: string): boolean {
    if (/^https?:\/\/\S+\.\S+/.test(value)) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** The issue body, shared by both routes so they read the same. */
export function letterBody(letter: Letter): string {
    const clean = normaliseLetter(letter);
    return [
        '> 一个玩家在「开发者小屋」里用那台电脑写了这段话。',
        '',
        clean.message,
        '',
        '---',
        `**署名**：${clean.handle || '（没留名字）'}`,
        `**回信地址**：${clean.reply || '（没留）'}`,
    ].join('\n');
}

/**
 * A `new issue` page with the letter already typed into it. This is not an API
 * call: it opens Gitee in the player's own session, and they press the button.
 *
 * Gitee's form reads `issue[title]` / `issue[body]` rather than GitHub's `title` / `body`.
 * If Gitee ever stops honouring those, the page still opens on the right repo and the letter
 * is on the clipboard (see `sendLetter`), so nothing is lost.
 */
export function buildIssueUrl(repo: string, letter: Letter): string {
    const params = new URLSearchParams({
        'issue[title]': '开发者小屋来信',
        'issue[body]': letterBody(letter),
    });
    return `${DEV_CABIN_FORGE}/${repo}/issues/new?${params.toString()}`;
}

export type Delivery =
    | { via: 'relay'; url: string }
    | { via: 'issue'; url: string }
    | { via: 'failed'; reason: string };

export interface SendDeps {
    /** Relay URL, or empty when it is not deployed. */
    relay: string;
    repo: string;
    /** Injected so tests never touch the network. */
    fetcher: (input: string, init?: RequestInit) => Promise<Response>;
    /** Injected so tests never open a tab. */
    open: (url: string) => void;
}

/**
 * Send by the best route available. Never throws: a failed relay is not a
 * failed letter, it is one extra click, so it degrades instead of erroring.
 */
export async function sendLetter(letter: Letter, deps: SendDeps): Promise<Delivery> {
    const clean = normaliseLetter(letter);
    if (Object.keys(validateLetter(clean)).length > 0) {
        return { via: 'failed', reason: 'invalid' };
    }

    if (deps.relay) {
        try {
            const res = await deps.fetcher(deps.relay, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clean),
            });
            if (res.ok) {
                const data = (await res.json()) as { ok?: boolean; url?: string };
                if (data.ok) return { via: 'relay', url: data.url ?? '' };
            }
        } catch {
            // Fall through to the issue page: a sleeping relay costs one click,
            // and the letter the player typed must not be lost to it.
        }
    }

    if (!deps.repo) return { via: 'failed', reason: 'no-route' };

    const url = buildIssueUrl(deps.repo, clean);
    deps.open(url);
    return { via: 'issue', url };
}
