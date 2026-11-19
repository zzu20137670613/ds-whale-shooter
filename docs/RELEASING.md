# Where the code and the releases live

*Policy set by the owner on 2026-11-13. It applies to every project in this workspace, not just
this game, and it does not expire.*

## The rule

| What | Where | Notes |
| --- | --- | --- |
| **Source code** | **Gitee only** | `git push` goes to Gitee. Nothing else. |
| **Release artifacts** | **GitHub Releases only** | APK / installer / zips attach to a release. |

Two halves, and they never swap: no code is pushed to GitHub, and no release binaries are
uploaded to Gitee.

## Why

The original GitHub account was suspended on 2026-10-30 (`docs/GITEE-MIGRATION.md`), so Gitee
became the source of truth. The owner has since registered a **new** GitHub account, and its only
job is shipping downloads — Gitee's 500 MB repo / 50 MB file caps make it a poor download host,
while GitHub Releases are free and unmetered.

## The frozen mirror on the old account (2026-11-19, one-time exception)

The *original* GitHub account `zzu20137670613` was suspended on 2026-10-30 and unbanned in
November. On 2026-11-19 the owner asked for its game repository to be refreshed once, so the
old page would not keep showing 1.3.0 code forever. That is **the only time code is allowed to
land on GitHub**, and it is recorded here so a future session does not read hard rule 14, see
code on GitHub, and "fix" it.

What was done, once:

| Item | Value |
| --- | --- |
| Repository | `zzu20137670613/ds-whale-shooter` (public, ~870 MB) |
| Branch / commit | `main` ← `b4947fc` *frozen snapshot v1.7.3: code lives on gitee now* |
| Content | one commit, no history, 1184 tracked files at v1.7.3 |
| Difference from Gitee | `README.md` carries a frozen-repository banner pointing at Gitee |
| How | `git -c core.hooksPath=/dev/null push -f <ssh url> <commit>:refs/heads/main` with `GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519'` |

Rules that follow from it:

- **Do not push to the old account again.** It is a read-only mirror; the banner says so.
- **Do not create code repositories there.** The owner cannot even sign in to it any more
  (no recovery codes), so nothing could be managed afterwards.
- The mobile half was left alone on purpose: there was never a mobile repository on the old
  account, and `ds-whale-video` — the only candidate to repurpose — is the closed-source
  快影AI distribution repo. Renaming it was considered and declined on 2026-11-19.
- The repository description still reads `deepseek鲸鱼娘闯关游戏`; it cannot be edited without
  account access. Leave it.

## The new GitHub account

| Field | Value |
| --- | --- |
| Login | `zzu20137670613-shhx` |
| Email | `1263943582@qq.com` |
| SSH key | `~/.ssh/id_ed25519_whale` (public comment `whale-new-github`) |
| Host alias | `github.com → ssh.github.com:443` in `~/.ssh/config` (port 443, because 22 is unreliable here) |

Verify the key with `ssh -T git@github.com`; it answers
`Hi zzu20137670613-shhx! You've successfully authenticated`.

Repositories on the account:

| Project | GitHub repository | Gitee repository |
| --- | --- | --- |
| This game, desktop | `ds-whale-shooter-PC` | `zzu20137670613/ds-whale-shooter-PC` |
| This game, phone | `ds-whale-shooter-mobile` | `zzu20137670613/ds-whale-shooter-mobile` |
| Desktop release hub | `ds-whale-desktop` | — |

Also present: `ds-galgame-mobile`, `ds_galgamePC`, `ds-kuaiying-PC`, `ds-smart-whale`.

Each GitHub repository carries a single **`release`** branch: one `README.md` and nothing else.
That branch exists so a tag has something to point at (see below); it is not a code mirror.

## Why the `release` branch exists

A GitHub Release attaches to a tag, and a tag points at a commit. With an empty repository there
is no commit, so GitHub refuses to publish the release.

The fix in place (owner's choice, 2026-11-13) is an **orphan `release` branch holding one
`README.md`**, tagged per version. Assets attach to those tags; no game source ever leaves Gitee.
Pushing real code tags instead would drag the source objects up with them — that is the thing the
rule forbids, so don't.

As of 2026-11-13 both `ds-whale-shooter-PC` and `ds-whale-shooter-mobile` have that branch and a
`v1.6.0` tag on it.

## Publishing a release

`gh` is the tool, but it must be authenticated first — the SSH key alone can push git objects
and cannot create releases. Without a token `gh` answers
`To get started with GitHub CLI, please run: gh auth login`:

```bash
gh auth login --hostname github.com --git-protocol ssh
```

That writes `%APPDATA%\GitHub CLI\hosts.yml`. If that file is `{}`, the login did not take -
re-run it; a `GH_TOKEN` environment variable works too.

Then, from the repo that holds the artifacts:

```bash
gh release create v1.6.0 \
  --repo zzu20137670613-shhx/ds-whale-shooter-PC \
  --title "深海回响 · 枪火柔情 v1.6.0" \
  --notes-file docs/RELEASE-1.6.0.md \
  "release/深海回响 · 枪火柔情-安装程序-1.6.0.exe" \
  "D:/ds-whale-shooter-mobile/apk/深海回响 · 枪火柔情-release-1.6.0.apk"
```

Notes live in `docs/RELEASE-<version>.md`; each one already carries the asset sizes and SHA-256
digests, which is what the release page should show.

## What NOT to do

- `git remote add github …` and push branches to it. There is no code remote for GitHub, on
  purpose.
- Upload release zips to Gitee (50 MB per file limit, and it is not the download channel).
- Re-use the old suspended account or its keys. `~/.ssh/id_ed25519` (comment `3047813125@qq.com`)
  is the legacy identity and is not used for either host.