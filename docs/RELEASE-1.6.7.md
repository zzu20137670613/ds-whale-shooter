# 深海回响 · 枪火柔情 — v1.6.7（versionCode 17，安卓测试包）

1.6.6 修掉了 `Phaser is not defined`，光柱终于能创建出来了；然后它立刻露出**同一个光柱的第二层坑**：

```
game:loop: Cannot read property 'sourceSize' of null
```

## 真凶

`Anims` 是**全局**的（`scene.anims` 跨场景共用），贴图是**按场景**加载、离开关卡时被
`releaseLoadedTextures()` 用 `textures.remove()` 卸掉的：

1. 进关 → 加载 `token-beam-sheet` → 建动画，帧指向这一份贴图的 Frame；
2. 离关（重开、传送、退出）→ 贴图移除 → 它的 Frame 全部 `destroy()`，`frame.data = null`；
3. 再进关 → `anims.exists('token-beam')` 仍然为真 → **我写的 `ensureTokenBeamAnim` 直接
   return 了** → 光柱播的还是上一份死帧 → 渲染时读 `frame.sourceSize`，`data` 是 null，报错。

所以这个 bug 有个很典型的特征：**第一次打 boss 是好的，重开/换关之后再打同一个 boss 就炸**。

## 修法

照 `createMonsterAnims` / `createDropAnims` 那两处的老套路来（它们一直都是先 `remove` 再
`create`，所以怪物和掉落物从来没这个问题）：

```ts
const framesAreLive = existing?.frames?.length === frames &&
                      existing.frames.every((f) => !!f?.frame?.data);
if (framesAreLive) return;
if (existing) scene.anims.remove(TOKEN_BEAM_ANIM);
scene.anims.create({ ... });
```

帧还活着就复用（同场景第二个光柱不重开），死了就重建。

顺带把全仓的 `anims.exists` 用法过了一遍：其余都是「存在才 play」或「先删后建」，只有光柱这一处
是「存在就 return」，只此一个。

## Assets

| Asset | Size | SHA-256 |
| --- | --- | --- |
| `shenhaihuixiang-v1.6.7-android.apk` | 377.5 MB | `D015FB494947710761B0050F6F4461DFCB5F44D9715353D9F25EA714064369B0` |

## 安装

覆盖安装即可，存档保留（versionCode 16 → 17）。
签名证书 SHA-256：`97382ac1f88dbc3b1d0bc535584b6aae2b5c74c4e65386dfb8d4c883d7bae994`（与前几版同一把，可直接覆盖安装。）
