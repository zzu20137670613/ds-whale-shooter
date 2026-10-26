/**
 * art-source/dev-cabin/relay/server.mjs
 * --------------------------------------------------------------------------
 * The same relay as `worker.js`, for a machine you own instead of an edge
 * runtime. Same contract, same secret, no dependencies — plain `node:http`.
 *
 *   GH_TOKEN=ghp_xxx GH_REPO=owner/repo node server.mjs
 *
 * This one DOES have to be awake when a letter arrives. If it is not, the game
 * falls back to opening a pre-filled "new issue" page and the player submits it
 * themselves, so a sleeping machine costs one extra click, never a lost letter.
 * (The edge version in `worker.js` has no such window - prefer it.)
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 38931);
const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO;

if (!TOKEN || !REPO) {
    console.error('Need GH_TOKEN and GH_REPO in the environment.');
    process.exit(1);
}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const clean = (value, max) =>
    String(value ?? '')
        .replace(/\r\n/g, '\n')
        .slice(0, max)
        .trim();

const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
    res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        res.end();
        return;
    }
    if (req.method !== 'POST' || req.url !== '/dev-cabin') {
        send(res, 404, { ok: false, error: 'not found' });
        return;
    }

    let raw = '';
    for await (const chunk of req) {
        raw += chunk;
        // Nothing legitimate is bigger than a few KB; stop reading past that.
        if (raw.length > 20_000) {
            send(res, 413, { ok: false, error: 'too large' });
            return;
        }
    }

    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        send(res, 400, { ok: false, error: 'bad json' });
        return;
    }

    const message = clean(payload.message, 4000);
    const reply = clean(payload.reply, 200);
    const handle = clean(payload.handle, 60);
    if (message.length < 2) {
        send(res, 400, { ok: false, error: 'empty' });
        return;
    }

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

    try {
        const upstream = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'dev-cabin-relay',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, body, labels: ['dev-cabin'] }),
        });
        if (!upstream.ok) {
            send(res, 502, { ok: false, error: `github ${upstream.status}` });
            return;
        }
        const issue = await upstream.json();
        send(res, 200, { ok: true, url: issue.html_url });
    } catch (error) {
        console.error('[relay] github call failed', error);
        send(res, 502, { ok: false, error: 'upstream' });
    }
}).listen(PORT, '127.0.0.1', () => {
    console.log(`[relay] listening on http://127.0.0.1:${PORT}/dev-cabin`);
});