# Worker relay template — a web form that files a Gitee issue

A ~150-line Cloudflare Worker (or any edge runtime with `fetch`) that lets a static game page drop
a message straight into a repository's issue list, without shipping a token to every player.

This is the generalised version of the relay this game runs, extracted so the next project does not
have to rediscover the Gitee API's four traps.

| File | What it is |
| --- | --- |
| [`worker.template.js`](./worker.template.js) | The template. Copy it into the Cloudflare dashboard as-is. |
| [`worker.js`](./worker.js) | The original, repo-hardcoded Worker this game actually runs. |
| [`README.md`](./README.md) | The historical write-up, from when the cabin posted to GitHub. Stale on the token fields; see below. |

## Contract

```http
POST /                                # the Worker's root: no sub-paths
Content-Type: application/json
Origin: https://your.site             # must be listed in ALLOWED_ORIGINS

{ "handle": "署名", "reply": "you@example.com", "message": "正文" }
```

| Response | Body |
| --- | --- |
| `200` | `{ "ok": true, "url": "https://gitee.com/<owner>/<repo>/issues/12" }` |
| `400` | `{ "ok": false, "error": "empty" }` — under 2 characters of actual text |
| `400` | `{ "ok": false, "error": "bad json" }` |
| `403` | `{ "ok": false, "error": "origin not allowed" }` — no CORS headers, so the browser blocks it |
| `405` | `{ "ok": false, "error": "POST only" }` |
| `500` | `{ "ok": false, "error": "GITEE_REPO not set" }` |
| `502` | `{ "ok": false, "error": "gitee 401" }` — Gitee refused; its body is never echoed |

`OPTIONS` answers `204` with the CORS preflight headers.

**Field limits** (the Worker clamps them; mirror them in the client so the player is told before
sending): `message` ≤ 4000 and ≥ 2 characters, `reply` ≤ 200, `handle` ≤ 60.

## Deploy

1. **Gitee token.** Gitee → 设置 → 私人令牌 → scope `projects`, which covers filing issues. Gitee
   shows the token exactly once.
2. **Create the Worker.** Cloudflare dashboard → Workers & Pages → Create → Worker → paste
   `worker.template.js` → Deploy.
3. **Variables and Secrets.**

   | Name | Kind | Example |
   | --- | --- | --- |
   | `GITEE_TOKEN` | secret | the token from step 1 |
   | `GITEE_REPO` | text | `your-name/your-repo` |
   | `ALLOWED_ORIGINS` | text | `https://your.site,http://localhost:5173` |

4. **Wire the page.** POST the three fields to the Worker URL. A non-200 means "the relay is
   asleep", not "the letter failed": fall back to opening Gitee's pre-filled new-issue page
   (`/<owner>/<repo>/issues/new?issue[title]=…&issue[body]=…`) so the player's text is never lost.

## The four traps

Learned by hitting each one against the real API.

1. **Routes.** Post to `https://gitee.com/api/v5/repos/{owner}/issues`. The body's `repo` field
   takes the **bare** repository name (`my-repo`). Passing `owner/repo` there makes Gitee answer
   `404 Not Found Project`, which points at nothing useful — the path was never the problem.
2. **Auth.** The token goes in the body as `access_token`. Gitee does not take a Bearer header.
3. **No `labels`.** Creating an issue rejects unknown fields; `labels` is one of them (400).
4. **Owner in the path, repo in the body.** Both `/repos/{owner}/issues` and
   `/repos/{owner}/{repo}/issues` exist, but the first still needs `repo` in the body to know
   where the issue lands.

## What not to copy from the original

The deployed version sends `Access-Control-Allow-Origin: *`. Anyone who found the URL could file
issues against that repository, and CORS was doing no work at all.

The template fails closed: no `ALLOWED_ORIGINS` means no CORS headers at all, and a request from
an unlisted origin is refused with `403` before Gitee is ever called.

That is still not rate limiting. A public endpoint can be spammed by anybody who knows the URL and
fakes an `Origin` header — a Worker cannot tell a browser from `curl`. If that matters, add a
Cloudflare Rate Limiting rule on the route, or a KV-backed per-IP counter.

## Testing without a browser

```bash
curl -i -X OPTIONS https://<worker-url> \
  -H "Origin: https://your.site" \
  -H "Access-Control-Request-Method: POST"

curl -i -X POST https://<worker-url> \
  -H "Origin: https://your.site" \
  -H "Content-Type: application/json" \
  -d '{"handle":"test","reply":"t@example.com","message":"relay smoke test"}'
```

The `POST` should return `{"ok":true,"url":…}` and the issue should appear in the repository.
Delete the smoke-test issue afterwards.