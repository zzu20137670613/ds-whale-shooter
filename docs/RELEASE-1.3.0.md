# 深海回响 · 枪火柔情 — v1.3.0

Release notes, written so they can be pasted into GitHub unchanged when that account
comes back. Everything here is already on Gitee; the two binaries live only on this
machine until the GitHub release exists.

## Assets

| Asset | Size | SHA-256 |
| --- | --- | --- |
| `深海回响 · 枪火柔情-安装程序-1.3.0.exe` | 471.6 MB | `7cf6e5009664bcdf44f70713cd90e6fea69e0cc46c37321dab01aa55954f9bc3` |
| `深海回响 · 枪火柔情-1.3.0-win64.zip` | 504.1 MB | `6b6eabf9789ff525163b12fbde4daecad04eaaf6a556ae2f2f49bd410241b5bb` |

- **Installer is the main download.** Double-click, pick a folder (defaults to `D:\深海回响 ·
  枪火柔情` when that drive exists), play. Uninstalling keeps the save.
- **The zip is the portable build** for people who do not want an installer: unpack and run
  `深海回响 · 枪火柔情.exe`.
- Neither is code-signed. First run of a downloaded copy shows 「Windows 已保护你的电脑」 →
  **更多信息 → 仍要运行**. A locally built copy does not show it.

## What changed in 1.3.0

### Boss fight

- **The boss is called `Claude` on every rung**: 灭世·Claude → 神·Claude → 半神·Claude →
  半神半人·Claude → Claude.
- **The three-second fall between the first two phases actually plays.** It was cut off after
  a single frame by the animation track picker, so 神·Claude appeared seamlessly. The pause is
  now one 3 s fall instead of a 2 s clip plus 2 s of standing still.

### Progress and shop

- **Beating the boss no longer wipes the upgrades.** Entering the fight maxes the panel and
  every gun; that used to overwrite the saved ladders, so the merchant showed `0 / 5` for
  everything afterwards. The real values are snapshotted on the way in and restored on the
  way out.
- **「补满状态」 now visibly fills the bars.** The shop pauses the scene, and the HP/SP mirror
  only ran in the per-frame update — money updated, bars did not. It also priced the button
  with the flat base price while charging the armour-ladder price.

### HUD and input

- **`I` opens the backpack**, alongside `B`.
- **A 「全屏 / 窗口」 toggle** sits between the aim switch and the source link. It follows
  plain fullscreen, Esc and F11, so the label never lies.

### Rendering

- **Nothing can be drag-selected any more.** Holding the mouse to aim used to paint
  Chromium's blue selection highlight over whatever the pointer crossed; over a comic page it
  read as a full-page blue tint.

### Desktop build

- **Installer defaults to `D:\深海回响 · 枪火柔情`** when a D: drive exists, keeps the previous
  folder on an upgrade, and falls back to `%LOCALAPPDATA%\Programs` (no admin prompt).
- **One icon everywhere**: window title bar, taskbar, tray, browser tab and the setup file all
  carry the whale avatar.
- **No solid compression**, so the installer does not need half a gigabyte of `%TEMP%` before
  it can show its first page.

## Verification

- `pnpm test` — **1773 passing** (195 files)
- `pnpm type-check` — clean
- Save data lives in `%APPDATA%\深海回响 · 枪火柔情` and survives uninstall/reinstall.