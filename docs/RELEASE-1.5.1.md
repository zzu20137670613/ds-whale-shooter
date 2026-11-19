# 深海回响 · 枪火柔情 — v1.5.1（versionCode 8）

手机端实测后的一轮 HUD 与地图修正。PC 端行为不变（徽章宽度、图书馆入口禁刷这两条是共用的）。

## TapTap 更新说明（可直接粘贴）

```
v1.5.1 更新内容

· 手机端右上角重新排版：从上到下改为 武器格 → 剩余怪物数 → 连击数，武器格挪到最上面。
· 手机端语言切换与金钱挪到左上角、血量灵力条的右侧，不再压住场景标题。
· 手机端背包面板整体等比缩小 1/5，小屏手机上也不会超出屏幕高度。
· 鲸鱼娘本人游玩 buff 徽章总宽度缩减 1/6（词元盾徽章同步变窄，两枚依旧对齐）。
· 星空图书馆入口关：右上角那片星空不再刷怪，怪物只出现在实地上。
```

## Assets

| Asset | Size | Notes |
| --- | --- | --- |
| `深海回响 · 枪火柔情-release-1.5.1.apk` | 463.1 MB | `32DF4B070B246A031217C42D4301D9FEB719B48540C29B3D1E8B66338384724F`<br>signed release, `versionCode 8`, `versionName 1.5.1`, `minSdk 24`, `targetSdk 36` |

- Signed with the same release key as 1.4.0 / 1.5.0
  (`SHA-256 97382ac1f88dbc3b1d0bc535584b6aae2b5c74c4e65386dfb8d4c883d7bae994`), so it upgrades in
  place and saves survive.
- Windows artifacts were **not** rebuilt for this release: the owner asked for the APK only.

## What changed

### Phone HUD (`src/lib/hud/mobile-layout.ts`)

The right-hand column was 连击 → 剩余怪物数 → 武器格; the owner wants 武器格 → 剩余怪物数 → 连击.

| Widget | Before | After |
| --- | --- | --- |
| Weapon grid | `top: 200` | `top: 88` |
| 剩余怪物数 | `top: 10.5rem` (168) | `MONSTER_COUNTER_TOP_PX` (212) |
| 连击数 | `top: 26` (104) | `COMBO_TOP_PX` (236) |

Both counters are placed against the grid's **design capacity** (2×2), so picking up a third
weapon cannot slide them down the screen.

- **语言切换 + 金钱** moved from the top-right corner to the HP/SP card's right side
  (`TOP_CHIP_LEFT_PX = 244`, stacked `topChipTop(0|1)`). They stack vertically because two chips
  side by side would run under the centred level title.
- **背包按钮** could no longer live between 武器4 and 技能 — that gap now holds the two counters —
  so it sits one key to the left of 技能 (`BACKPACK_RIGHT_PX`, `BACKPACK_BOTTOM_PX`), clear of both
  技能 and 开火.
- **背包面板** is drawn at `transform: scale(...)`: `MOBILE_BAG_SCALE = 0.8` (the owner's 4/5), and
  `bagScale()` shrinks further if 0.8 would still overflow the screen, so a short phone never clips
  the panel again.

### Buff chips

`BUFF_CHIP_WIDTH` 212 → 177 px (≈ 5/6). Both chips read the same constant, so they stay aligned.

### 星空图书馆入口关

The top-right of the plate is the starry void above the torn floor edge; two of the quadrant's five
far spawn slots landed in it. A no-spawn rectangle `{ x: 3400, y: 0, width: 2104, height: 1300 }`
covers the void, and the spawner's own edge-push moves those points down onto the floor (`y ≈ 1324`).
`tests/lib/levels/library-entrance-exclusion.test.ts` replays the spawner's placement arithmetic
against the level data and asserts no far point survives inside the ban.