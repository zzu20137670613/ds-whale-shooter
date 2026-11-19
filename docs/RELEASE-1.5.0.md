/**
 * docs/RELEASE-1.5.0.md — 深海回响 · 枪火柔情 v1.5.0
 *
 * TapTap 上已经是 1.4.0，这一版按版本号 1.5.0（versionCode 7）发布。
 * 下面第一段是可直接粘贴到 TapTap 更新说明里的中文文案；后面是给仓库看的技术记录。
 */

# 深海回响 · 枪火柔情 — v1.5.0（versionCode 7）

## TapTap 更新说明（可直接粘贴）

**v1.5.0 更新内容**

- **三只守关 Boss 登场**：星海狙击线新增 Kitty、天空之城新增 Bunny、亚特兰蒂斯新增 Wanderer。
  她们各自借用「半神 · Claude」的一招（三连炮 / 弹幕 / 三连击＋天谴轰炸），守在每张地图的第三波。
- **词元盾**：守关 Boss 必定掉落。最多 5 级，每级把 10% 的受伤从血量转到灵力（满级 50%），
  灵力不够时整次伤害仍落在血量上。等级跟随背包里的个数，读档不会掉。
  掉落时地面有专属光柱：天空之城紫色，图书馆与亚特兰蒂斯深金色。
- **Boss 四关四阶段**：Boss 战拆成四张地图，每张打 Claude 的一个形态——灭世 → 神 → 半神 → 半神半人。
  只有第四张打完才是结局，前三张清关后走传送阵继续。
- **近战八向攻击**：近战不再只能左右挥，上下与四个斜向都能打到。
- **清关自动存档**：最后一只怪倒下、出口传送阵出现时自动存一次。
- **手感与地图修正**：图书馆柜台关的右下大书桌不再刷怪；亚特兰蒂斯加冕台右上角禁刷；
  初遇之地的铁盆改成走进去即触发彩蛋。

## Assets

| Asset | Size | Notes |
| --- | --- | --- |
| `深海回响 · 枪火柔情-release-1.5.0.apk` | 463.1 MB | `61E5A5D3F56FEB12285B9F6E1658177181F347D5B7A1F7214C3329BFB1B45960`<br>signed release, `versionCode 7`, `versionName 1.5.0`, `minSdk 24`, `targetSdk 36` |
| `深海回响 · 枪火柔情-安装程序-1.5.0.exe` | 603 MB | `282BA2FBF0EA641D2A8C47FB2026107D1A86129FDFE2C1FDD3349831F4C8571A`<br>Windows installer, unsigned |

- Both are built from the same web bundle (`dist/` → `www/` → Capacitor for Android, `release/` for
  Windows), so gameplay is identical; only the shells differ.
- The APK is signed with the same local release key as 1.4.0
  (`SHA-256 97382ac1f88dbc3b1d0bc535584b6aae2b5c74c4e65386dfb8d4c883d7bae994`), so it upgrades the
  installed 1.4.0 in place — saves survive.
- `versionCode 7` is the point of this release: TapTap already carries 1.4.0, and a store build must
  raise the code to replace an installed copy.

## What changed since 1.4.0

### Boss
- **Three guardians** (`kitty`, `bunny`, `wanderer`): 1000–3000 HP, drawn at half scale, one borrowed
  半神 attack each — `triple-cannon`, `barrage`, and the new `triple-wrath` (three shells, then 天谴轰炸).
  They occupy the last wave of each four-room world via `spawner.finalWave`.
- **One phase per map.** `level.bossPhase` (1–4) tells the arena which of Claude's four forms it owns;
  the phase is applied at spawn (HP, size, damage), and clearing it ends the fight instead of walking
  into the next form. Settlement only fires on the last map (`bossSettlementDue`).
- **Maps 2–4 spawn their boss at `arenaSpawn[0]`.** Those levels carry `monsters: []` — the old
  design walked her in on the arena arrow, which no longer runs once the plate is one phase.

### Drops
- **词元盾 (Token Shield)**: five levels, `n × 10%` of an incoming hit moved from HP to SP, applied on
  pickup (never bagged), sixth pickup refills both bars.
- **Level = bag count.** `tokenShieldLevelOf` reads the inventory (capped at 5) with the old
  per-character table as a fallback, so a reload can never drop the buff.
- **Sprite and pillar.** Its own 64×64 drop frame (`drops/token-shield.png`), a 60 px-wide light
  pillar with `tokenPillarTone` per map: `dark` (violet) on the sky city, `gold` on the library and
  Atlantis, everything else `bright`.
- **HUD chip** under the whale-girl chip, same shell/background/width (`BUFF_CHIP_*`).

### Combat
- **Eight-way melee**: `melee-arc.ts` snaps the aim to eight sectors and rotates the sensor body;
  `spawnMeleeHitbox` places it along the swing instead of snapping to left/right.

### Levels and saves
- Library counter: the big desk is a no-spawn rectangle. Atlantis dais: top-right corner excluded.
- Auto save when the exit portal fades in (`shouldSaveOnClear`).
- The rice bowl at 初遇之地 is a `trigger: walk` interactable — walking into it is enough.
- Claude can step on the Atlantis throne into the boss chain (`excludeCharacters` removed).
