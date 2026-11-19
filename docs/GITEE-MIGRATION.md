# Migrating to Gitee

*Measured 2026-10-30, before the move. Numbers, not estimates.*

## Why this document exists

GitHub is blocked twice over — the account is suspended and the site is unreachable from here.
Gitee becomes the source of truth; GitHub stays as a release-download channel until the next
big update. Gitee's limits are **500 MB per repository** and **50 MB per file**, and this
project was well past both. This is the record of what had to change and why, so nobody
re-measures it later.

**Update, 2026-11-13:** that "until the next big update" has become the permanent split. The
owner registered a new GitHub account (`zzu20137670613-shhx`) purely as the download channel:
code lives on Gitee and nowhere else, artifacts go to GitHub Releases and nowhere else. See
[`RELEASING.md`](./RELEASING.md) for the account, the repositories and the commands.

## What was actually in the repository

| Path | Files | Size | Verdict |
| --- | --- | ---: | --- |
| `art-source/` (working art) | 292 | **508 MB** | untracked — see below |
| `public/assets/` (shipped art) | 379 | 306 MB | stays; largest single file 18.3 MB |
| `src/` | 210 | 1.5 MB | stays |
| `tests/` | 116 | 0.5 MB | stays |
| `docs/` | 16 | 0.3 MB | stays |

Eight files were over Gitee's 50 MB per-file cap **on their own**, the largest two at 65.7 MB
— all of them world plates under `art-source/*/world/`.

`.git` itself was **935 MiB**, so even a code-only branch carried the dead weight in history.

## The change: `art-source/` is untracked

`.gitignore` now excludes it, keeping only the parts a reader needs:

```gitignore
art-source/**
!art-source/**/
!art-source/**/*.md
!art-source/**/*.txt
```

- **Tracked after the change:** 829 files, **309 MB** — inside the 500 MB cap.
- **Tracked in `art-source/`:** 69 files, **0.2 MB** — design notes (`LEVEL-DESIGN.md`) and the
  generation prompts. The pictures themselves stay on disk, out of every repository.

The art was never needed to build or run the game: `public/assets/` holds what ships, and
`art-source/` holds what the art was drawn from. Losing it from history costs nothing but a
local folder, which the owner keeps anyway.

## How to actually move it

The history is 935 MiB of objects. Pushing it and then deleting files does not shrink what
Gitee receives, so **do not migrate this history**. Start clean:

```powershell
# 1. a fresh clone of the working tree only - no history
robocopy <repo> D:\gitee\ds-whale-shooter-PC /E /XD .git node_modules dist

# 2. fresh repository, one commit
cd D:\gitee\ds-whale-shooter-PC
git init
git add -A
git commit -m "chore: import 1.3.0"

# 3. point it at Gitee and push
git remote add origin <gitee-url>
git push -u origin master
```

One commit means the first push is ~309 MB packed, once — no history to re-send on every
later push.

**If history must be kept**, `git filter-repo --path art-source --invert-paths` first, then a
`git gc --aggressive --prune=now`. That took the object count from 4811 loose files to a pack
in the reference run; it is slower and easy to get wrong, so prefer the fresh-clone route
unless someone actually needs the old commits on Gitee.

## What does not move

- `node_modules/`, `dist/` — generated, ignored as before.
- `art-source/**` pictures — local only.
- The two comparison dumps in `whale-shooter/` (outside this repo) — working scratch.

## Open question for 第七世

Whether `ds-whale-shooter` migrates whole (code + the 306 MB of shipped art) or code-only with
the art served from release assets. Code-only needs a loader change: `public/assets` is fetched
by relative path everywhere, so art would have to come from a CDN base URL or a release zip.
Whole-repo is 309 MB, which fits — it is the cheaper answer unless the 500 MB cap is a hard
ceiling rather than a soft one.

## Done — 2026-10-30 13:00

Pushed to <https://gitee.com/zzu20137670613/ds-whale-shooter> in two batches: code and data
(3.5 MB) first, then the shipped art (306 MB, 428 s). Default branch is `main`; the temporary
`master` ref was deleted after the switch. Old GitHub history lives in the local branch
`archive/github-history` and nowhere else.
