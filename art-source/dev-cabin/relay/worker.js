/**
 * art-source/dev-cabin/relay/worker.js
 * --------------------------------------------------------------------------
 * The 30-line relay that lets the developer cabin's "send" button drop a
 * message straight into the repo's issue list, without shipping a GitHub token
 * to every player.
 *
 * It runs on Cloudflare Workers (or any edge runtime with `fetch`): free tier,
 * no machine of yours needs to stay on, nothing to keep alive between
 * messages. The token lives here, in a secret, and nowhere else.
 *
 * Deploy:
 *   1. Fine-grained PAT, this repo only, Issues = Read and write.
 *   2. Cloudflare dashboard -> Workers & Pages -> Create -> Worker -> paste
 *      this file -> Deploy.
 *   3. Worker -> Settings -> Variables and Secrets -> add secret GH_TOKEN,
 *      and plain variable  GH_REPO = zzu20137670613/ds-whale-shooter.
 *   4. Hand the https://<name>.<account>.workers.dev URL to the game.
 *
 * Contract (what the game posts):
 *   POST { reply: string, message: string, handle?: string }
 *   200 { ok: true, url }   |   4xx/5xx { ok: false, error }
 */

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status, extra = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
    });

/** Strip anything that would let a player forge structure in the issue body. */
const clean = (value, max) =>
    String(value ?? '')
        .replace(/\r\n/g, '\n')
        .slice(0, max)
        .trim();

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

        let payload;
        try {
            payload = await request.json();
        } catch {
            return json({ ok: false, error: 'bad json' }, 400);
        }

        const message = clean(payload.message, 4000);
        const reply = clean(payload.reply, 200);
        const handle = clean(payload.handle, 60);

        // Too short is almost always a mis-click rather than a letter.
        if (message.length < 2) return json({ ok: false, error: 'empty' }, 400);
        const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
        const title = `开发者小屋来信 · ${stamp}`;
        const body = [
            '> 一个玩家在「开发者小屋」里用那台电脑写了这段话。',
            '',
            message,
            '',
            '---',
            `**署名**：${handle || '（没留名字）'}`,
            `**回信地址**：${reply || '（没留）'}`,
            `**时间**：${stamp} UTC`,
        ].join('\n');

        const res = await fetch(`https://api.github.com/repos/${env.GH_REPO}/issues`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.GH_TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'dev-cabin-relay',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, body, labels: ['dev-cabin'] }),
        });

        if (!res.ok) {
            // Never leak the GitHub response body: it can contain the token's
            // scopes and the repo's internals.
            return json({ ok: false, error: `github ${res.status}` }, 502);
        }
        const issue = await res.json();
        return json({ ok: true, url: issue.html_url }, 200);
    },
};