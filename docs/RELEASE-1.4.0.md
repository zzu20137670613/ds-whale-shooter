# 深海回响 · 枪火柔情 — v1.4.0

First store build. Everything below ships in the Android APK that goes to TapTap; the desktop
installer carries the same game code.

## Assets

| Asset | Size | Notes |
| --- | --- | --- |
| `深海回响 · 枪火柔情-release-1.4.0.apk` | 463.1 MB | `657CA36B9625C3326E872CDE8B145D1D43B18C2C9C056C8DD1022DFB64DE0E5D`<br>signed release, `versionCode 6`, `minSdk 24`, `targetSdk 36`, no native libraries |
| `深海回响 · 枪火柔情-安装程序-1.4.0.exe` | 603 MB | `7A1013EA25A4AEA4AC6E4E8AE4DB9F96E26FEF49E8745472FFCBF06F841001FF`<br>Windows installer, unsigned |

- The APK is signed with the local release key (`android/app/shenhai-release.keystore`). The
  certificate fingerprint is recorded in the persona memory; losing the key means the app can
  never be updated in place again.
- Installed over the debug build it will be rejected — uninstall first. Saves do not survive
  that, because a different signature is a different application.

## 本版新增（2026-11-12）

- **三只守关 boss**：图书馆 Kitty、天空之城 Bunny、亚特兰蒂斯 Wanderer，各自借用半神 Claude 的一招
  （三连炮 / 弹幕 / 三连击＋天谴轰炸），站在四关地图的第三波。
- **词元盾**：守关 boss 100% 掉落，5 级、每级 10% 伤害改由灵力承担；等级跟着背包里的个数走；
  掉落带光柱（天空之城紫色，图书馆/亚特兰蒂斯深金色），HUD 徽章挂在鲸鱼娘徽章正下方。
- **boss 四关四阶段**：四块地图各打 Claude 一阶段，只有第四关进结算；2/3/4 关的 boss 现在开场就在场。
- **近战八向判定**：斜向/上下都能打到，命中的是旋转后的传感器。
- **清关自动存档**：最后一只怪倒下、出口传送阵淡入时存一次。
- **其它**：图书馆柜台关右下书桌不再刷怪；亚特兰蒂斯加冕台右上角禁刷；初遇之地铁盆改为走进去触发。

## Cold start

- **Our art instead of Capacitor's template.** The launch window used to show the stock blue
  Capacitor mark for a beat, before our own loading screen. All eleven `splash.png` buckets are
  now the loading key art, cover-cropped per screen shape.
- **No white flash between the two.** A fresh WebView paints white until the page has something
  to show; `MainActivity` now fills it with `#030508`, the boot screen's own colour.
- The whole start is therefore: key art → dark → key art with the progress bar.

## Story

- **Two cut-scenes play where they belong.** 《一夜鱼龙舞》 at the dragon throne when the fang is
  taken, 《牵手》 after the ending illustration. Both are 1080p remasters.
- **The ending runs in order.** Plate → clip → 「制作不易」 → back to the pavilion. A tap can no
  longer skip the clip that has not played yet; it advances the plate, then the clip, then the
  ledger.
- **Seed appears only after the boss is down**, in the pavilion's pickup phase, and opens a shop
  of her own. The three epilogue cats stand at the mysterious merchant's feet in the three
  four-room levels and each speaks a CDK line when tapped.

## Boss

- **The three-second beat between 灭世·Claude and 神·Claude actually reads now.** The sheet has
  no fall track — its `death` row is the crouch — so the beat is staged by tipping the sprite
  over and fading it, driven per frame rather than by a tween that other writers could override.
- **The phase reaches the HUD on the same frame** as the body instead of one frame later.

## Shop and vitals

- **「补满状态」 heals the character on screen.** A scene swap never tore the character down, so
  the paid refill healed the previous level's ghost and the bars never moved. Teardown is now
  explicit and the HUD push cannot be aborted by a cosmetic failure.
- Health shards are drunk automatically below 60 % HP on the mobile build, and the game says so.

## Engine

- **One bad frame no longer freezes a run.** The scene update is wrapped: a throwing frame is
  skipped and recorded instead of killing the loop.
- **Crash breadcrumbs on the device.** `window.onerror`, unhandled rejections and scene-update
  exceptions are kept in `localStorage` (last five, with stacks) so a player report can be
  diagnosed without a debugger.

## Mobile input

- Joystick pinned to its corner, fire and dodge swapped for thumbs, hotbar moved up.
- Backpack chip between the weapon grid and the skill key; the bag stays open under the tap that
  opened it.
- Eight-way aim regardless of pointer, and walking no longer counts as combat for the auto
  reload clock.

## Verification

- `pnpm test` — **2020 passing**
- `pnpm type-check` — clean
- Release APK installed on Android 9 (API 28): cold start, character select, level entry and the
  nickname prompt all exercised; `logcat` showed no fatal errors and WebView debugging stays off
  in the release build.
