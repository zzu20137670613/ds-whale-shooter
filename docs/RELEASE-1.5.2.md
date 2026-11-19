# 深海回响 · 枪火柔情 — v1.5.2（versionCode 9）

修 1.5.1 在手机上**所有大场景背景全黑**的问题，并补上 1.5.1 漏发的技能说明。

## 根因

手机的 WebGL `gl.MAX_TEXTURE_SIZE` 是 **4096**（模拟器实测），而十二张场景底图都是
**5504×3072**。Phaser 把每张底图当作一张贴图上传，超过上限的**静默失败**：怪（小贴图）照常出现，
房间却是全黑。包里 `dist` 的构建步骤本来有一步 `scripts/downscale-scenes.py` 专门把它们压到
4096，但那次构建打印的是：

```
• capping scene backgrounds at 4096 px
  下采样完成：0 张图        ← 一张都没处理
```

脚本只列了 `assets/image/scenes` 这一层，而场景图后来被按关卡分进了子目录
（`scenes/beach-holiday/beach-holiday.png`、`scenes/starry-library/…`），所以那个循环一个文件
都没匹配到；它又不算失败，构建继续，于是每个包都带着 5504px 的底图出门。首当其冲的是
`海滩假日` 和 `星空图书馆` —— 就是主人看到黑底的那两关，而**后面 17 张底图全部一样**。

## 修法

- `scripts/downscale-scenes.py`：改成递归遍历子目录；处理完再自检一遍，只要还有超过 4096 的图
  就打印清单并返回非 0。
- `scripts/build-web.mjs`：这一步不再“警告后继续”。找不到 Python/Pillow 或下采样失败 → **直接
  终止打包**。带黑图的 APK 不是“能用的重包”，不能就这么发出去。
- `src/game/scenes/scene.ts`：加载地面贴图时读一次本机 `MAX_TEXTURE_SIZE`，超限就
  `console.error` 报出贴图名和超出的尺寸。下次真再出这种事，控制台直接指认。

## Assets

| Asset | Size | Notes |
| --- | --- | --- |
| `深海回响 · 枪火柔情-release-1.5.2.apk` | 376 MB | `FAF0D9769526A6E889A53074E3BB94BF45C440AC74316DA700F4BA8FF2A86C4A`<br>signed release, `versionCode 9`, `versionName 1.5.2` |

- 17 张场景图降采样：`5504x3072 -> 4096x2286`，单张 18.3M → 12.1M。
- 包体积 463 MB → 376 MB（少了 87 MB）。
- 签名与 1.4.0 / 1.5.0 / 1.5.1 相同（`SHA-256 97382ac1f8…d7bae994`），可原地升级，存档保留。
- 画面损失：手机横屏约 2400×1080 像素，4096 的长边没有可见损失。

## 这一版同时带上

- **技能说明出现在手机选人卡上**（1.5.1 只加进了 PC 分支，`d94ba1a`）。
  `SkillBlock` 现在是 PC 与手机共用的一个组件。

## 验证

- `www` 内 269 张图片，超过 4096 的 **0 张**；APK 内 `assets/public/assets/image/scenes/*` 全部
  为降采样后的体积。
- 用打包产物（不是 dev server）跑了一遍移动端流程：背景正常出图，非黑屏。
- `pnpm test` 252 个文件 / 2205 条通过，`tsc --noEmit` 干净。