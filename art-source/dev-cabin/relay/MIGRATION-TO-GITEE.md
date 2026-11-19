# Moving the dev-cabin relay from GitHub to Gitee

**Who this is for:** whoever operates the Cloudflare Worker behind
`https://cabin.kuaiyingai.cloud`. The game side is already migrated and merged; **only the
deployed Worker is still talking to GitHub.**

## Why

The GitHub account was suspended on 2026-10-30 (API returns 404 for the user and the repo).
The in-game guestbook, the settings-panel source link and the "send a letter" fallback all
point at Gitee now. The relay is the last piece: today it posts to
`api.github.com/repos/{repo}/issues`, and that repo is about to be deleted.

## What the relay is

The game is a static page; it cannot create an issue on its own because that needs a token and
a token must never ship to players. The Worker holds the token server-side and turns one click
in the cabin into one issue. It has no database and no state — one POST in, one issue out.

**Contract stays the same.** The game posts:

```
POST https://cabin.kuaiyingai.cloud
Content-Type: application/json
{ "message": "...", "reply": "...", "handle": "..." }

200 { "ok": true,  "url": "<issue html_url>" }
4xx { "ok": false, "error": "..." }
```

**Do not change the hostname.** `cabin.kuaiyingai.cloud` is hard-coded in the shipped game
(`DEV_CABIN_RELAY` in `src/lib/dev-cabin/config.ts`). Renaming the Worker means re-releasing
the game. `*.workers.dev` is also unreachable from the owner's network (DNS sinkhole), which
is why the custom domain exists in the first place.

## What changes

| | GitHub (old) | Gitee (new) |
| --- | --- | --- |
| Endpoint | `https://api.github.com/repos/{repo}/issues` | `https://gitee.com/api/v5/repos/{owner}/issues` |
| Auth | header `Authorization: Bearer <token>` | **`access_token` field in the JSON body** |
| Path | `https://api.github.com/repos/{repo}/issues` | **`https://gitee.com/api/v5/repos/{owner}/issues`** — owner only, no repo segment |
| `repo` in body | not sent | **bare name**, `ds-whale-shooter` — never `owner/repo` |
| Labels | `labels: ["dev-cabin"]` | **removed** — Gitee has no such field on create, and an unknown label is a 400 |
| Response url | `issue.html_url` | `issue.html_url` (same key) |
| Secrets | `GH_TOKEN`, `GH_REPO` | `GITEE_TOKEN`, `GITEE_REPO` (`GH_*` still read as a fallback) |

### The 404 trap (measured 2026-10-30)

Both URL shapes exist: an unauthenticated POST to `/repos/{owner}/{repo}/issues` and to
`/repos/{owner}/issues` both answer **401**, while a nonsense route answers **404**. So a 404
was never about the path.

It was the body. `repo` must be the **bare repository name**; a value carrying a slash
(`zzu20137670613/ds-whale-shooter`) resolves to nothing and Gitee reports
`404 Not Found Project` — no scope hint, no mention of the offending field. That is the shape
`art-source/dev-cabin/relay/worker.js` sends now, and `tests/lib/dev-cabin/worker.test.ts`
pins it so it cannot drift back.

## Steps

### 1. Create a Gitee token

Gitee → 设置 → 私人令牌 → 生成新令牌.

- Scope: **`issues` only** (read + write).
- Do **not** grant repository write scope; the relay only files issues.
- Copy the token once — Gitee shows it a single time.

### 2. Set the Worker's variables

Cloudflare dashboard → Workers & Pages → the Worker serving `cabin.kuaiyingai.cloud` →
**Settings → Variables and Secrets**:

| Name | Type | Value |
| --- | --- | --- |
| `GITEE_TOKEN` | Secret (encrypt) | the token from step 1 |
| `GITEE_REPO` | Plain text | `zzu20137670613/ds-whale-shooter` |

Leave `GH_TOKEN` / `GH_REPO` in place if you like — the code prefers `GITEE_*` and only falls
back to `GH_*` when the new names are absent. Deleting them is also fine.

### 3. Deploy the new source

Paste this over the Worker ({`art-source/dev-cabin/relay/worker.js`} in the repo — keep the two
files identical):

```js
/**
 * art-source/dev-cabin/relay/worker.js
 * --------------------------------------------------------------------------
 * The 30-line relay that lets the developer cabin's "send" button drop a
 * message straight into the repo's issue list, without shipping a token to
 * every player.
 *
 * It runs on Cloudflare Workers (or any edge runtime with `fetch`): free tier,
 * no machine of yours needs to stay on, nothing to keep alive between messages.
 * The token lives here, in a secret, and nowhere else.
 *
 * Deploy:
 *   1. Gitee token, scope `issues`. (Was a GitHub PAT until the account was suspended.)
 *   2. Cloudflare dashboard -> Workers & Pages -> your Worker -> paste this file -> Deploy.
 *   3. Worker -> Settings -> Variables and Secrets -> secret GITEE_TOKEN,
 *      plain variable GITEE_REPO = zzu20137670613/ds-whale-shooter.
 *   4. The public URL must stay https://cabin.kuaiyingai.cloud - the game hard-codes it.
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
        const stamp = new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 16);
        const title = `开发者小屋来信 · ${stamp}`;
        const body = [
            '> 一个玩家在「开发者小屋」里用那台电脑写了这段话。',
            '',
            message,
            '',
            '---',
            `**署名**：${handle || '（没留名字）'}`,
            `**回信地址**：${reply || '（没留）'}`,
            `**时间**：${stamp}（北京时间）`,
        ].join('\n');

        const res = await fetch(
            `https://gitee.com/api/v5/repos/${env.GITEE_REPO ?? env.GH_REPO}/issues`,
            {
                method: 'POST',
                // Gitee takes the token in the body, not a Bearer header, and has no
                // `labels` field on create - sending an unknown label is a 400.
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    access_token: env.GITEE_TOKEN ?? env.GH_TOKEN,
                    repo: env.GITEE_REPO ?? env.GH_REPO,
                    title,
                    body,
                }),
            },
        );

        if (!res.ok) {
            // Never leak the upstream response body: it can contain the token's
            // scopes and the repo's internals.
            return json({ ok: false, error: `gitee ${res.status}` }, 502);
        }
        const issue = await res.json();
        return json({ ok: true, url: issue.html_url }, 200);
    },
};
```

If you deploy with `wrangler`, `wrangler deploy` from
`art-source/dev-cabin/relay/` is enough — the source there is the same file.

### 4. Verify

**a. CORS preflight** (must be 204, and the browser needs the headers):

```bash
curl -i -X OPTIONS https://cabin.kuaiyingai.cloud \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST"
```

**b. A real letter.** This creates a real issue — delete it afterwards:

```bash
curl -s -X POST https://cabin.kuaiyingai.cloud \
  -H "Content-Type: application/json" \
  -d '{"message":"relay migration smoke test","handle":"relay","reply":""}'
```

Expected: `{"ok":true,"url":"https://gitee.com/zzu20137670613/ds-whale-shooter/issues/N"}`.

Then open that URL, confirm the issue body has the message, signature and timestamp, and
**close/delete the test issue**.

**c. Failure modes to expect, and what they mean:**

| Response | Meaning |
| --- | --- |
| `{"ok":false,"error":"gitee 401"}` | token missing, expired, or wrong scope |
| `{"ok":false,"error":"gitee 403"}` | token lacks `issues` scope |
| `{"ok":false,"error":"gitee 404"}` | `GITEE_REPO` wrong, or token has no access to it |
| `{"ok":false,"error":"gitee 400"}` | body shape rejected — usually a stale deploy still sending GitHub's `labels` |

### 5. After it works

**Do not delete the GitHub repository.** The account is suspended, not gone: appeal ticket
#4927722 is open (filed 2026-10-30, GitHub acknowledged), and if it is restored the repository
comes back on its own — deleting it now would mean rebuilding it later. The 475 MB release
upload is also planned on that account. Gitee is the source of truth in the meantime; GitHub
is a Release mirror only, never a source mirror.

Order still matters for the switch-over: **verify step 4 first**, otherwise letters sent in
between are lost (the game falls back to the Gitee form, so they are not *silently* lost, but
it costs the player a click).

## Rollback

The Worker is stateless; rolling back means redeploying the previous source and restoring
`GH_TOKEN` / `GH_REPO`. The game keeps working either way — if the relay answers
`{ ok: false }` or does not answer at all, the cabin falls back to opening Gitee's
pre-filled new-issue page.

## Game-side config, for reference

- Relay URL: `DEV_CABIN_RELAY` in `src/lib/dev-cabin/config.ts`
  (`https://cabin.kuaiyingai.cloud`)
- Guestbook link: `DEV_CABIN_GUESTBOOK` in the same file
  (`https://gitee.com/zzu20137670613/ds-whale-shooter/issues`)
- Fallback form: `buildIssueUrl` in `src/lib/dev-cabin/mail.ts`
  (Gitee's `issue[title]` / `issue[body]` query fields)