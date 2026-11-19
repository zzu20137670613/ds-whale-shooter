# 深海回响 · 枪火柔情 — v1.6.6（versionCode 16，安卓测试包）

修 1.6.5 没修掉的那个真凶：**词元盾光柱里 `Phaser` 没 import**。

## 真凶

1.6.5 让游戏不再冻死，并在屏幕上打出了那句报错：

```
monster:died: Phaser is not defined
```

定位到 `src/game/drops/token-beam.ts`（2026-11-14 写光柱那一版）：

```ts
const blend = palette.useAdditive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
```

这个文件**从头到尾没有 `import Phaser`**。Phaser 的类型是全局命名空间，所以 `tsc` 一声不吭；
运行时它是 ReferenceError。抛出点在「死亡动画结束 → 掉战利品」的 `time.delayedCall` 回调里，
不在场景 update 的 try/catch 内 —— 于是 Phaser 的 RAF 链断掉，画布永久停在最后一帧，
而 React/DOM 一切正常。这就是「界面不动，摇杆背包还能点」。

只在**掉词元盾**的时候触发：词元盾只有三个守关 boss 掉（Kitty / Bunny / Wanderer），
所以表现就是「打死 boss 必卡死」。

## 修法

不 import 引擎，改用数字常量（和 `TINT_MODE_*` 那批一个路子，见 `src/lib/constants.ts`）：

```ts
export const BLEND_MODE_NORMAL = 0;
export const BLEND_MODE_ADD = 1;
```

顺带补了两道防线：

```
· tests/game/drops/token-beam-create.test.ts —— 真的调一次 createTokenBeam。
  之前的测试只测纯函数（配色、tone 归属），这个函数从没被调用过，所以一路绿灯。
· tests/lib/phaser-global-usage.test.ts —— 扫全仓：凡是代码里取 `Phaser.<成员>` 的文件，
  必须 import 过 phaser。编译期查不出来的一类错误，用这个兜住。
```

反向验证过：把 import 删掉，新测试立刻红，报的正是 `ReferenceError: Phaser is not defined`。

## Assets

| Asset | Size | SHA-256 |
| --- | --- | --- |
| `shenhaihuixiang-v1.6.6-android.apk` | 377.5 MB | `34E6A4A5EE4089F7D308C44424AC9AD8FE32D3FCED74443514387FBF13A28581` |

## 安装

覆盖安装即可，存档保留（versionCode 15 → 16）。
签名证书 SHA-256：`97382ac1f88dbc3b1d0bc535584b6aae2b5c74c4e65386dfb8d4c883d7bae994`（与前几版同一把，可直接覆盖安装。）
