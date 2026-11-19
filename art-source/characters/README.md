# Character art — walk rows

## Why this folder exists

The owner watches the roster walk side by side and ranks them by eye. That ranking is
backed by one number: **how much the leg band changes between the first and last frame of
the walk cycle.** Measured on the shipped sheets, bottom 38% of the cell, frames 4 vs 7:

| Character | Leg-band stride | What he says | Verdict |
|---|---|---|---|
| GPT | **31** | fine | reference bar |
| Claude | **33** | fine | reference bar |
| Gemini | 28 | slides | redraw |
| Qwen | 20 (but 1-2px legs) | "sprained her ankle" | redraw, feet first |
| DeepSeek | **8.5** | "legs are not moving" | redraw |

Code cannot fix this. `src/lib/characters/walk-bob.ts` adds a 2px body bounce so a stiff
cycle reads as steps instead of a slide, but it does not invent legs — a row whose poses are
the same pose stays the same pose.

## What Qwen's defect actually is

Measured per frame on her shipped 128px cells: each shank below the hem is **1-2 px wide**,
and the leading leg is drawn as an **outward curve** from the knee. The shoe then hangs off
the side of a one-pixel line. At gameplay scale (173px tall) that reads as a twisted ankle.
Her hem also covers the ankles, so there is nothing solid to read as a foot.

## Workflow

1. Generate the walk row with one of the prompts here:
   [`img-deepseek-walk-4f.txt`](./prompts/img-deepseek-walk-4f.txt),
   [`img-qwen-walk-4f.txt`](./prompts/img-qwen-walk-4f.txt),
   [`img-gemini-walk-4f.txt`](./prompts/img-gemini-walk-4f.txt).
   Four frames in one row, magenta field, ~2048×512.
   **The generator takes about 2000 characters**, so each prompt is written to fit under
   that: layout + character + the one thing being fixed, nothing else. Current sizes —
   DeepSeek 1756, Qwen 1790. If you add anything, cut something.

2. Drop the result anywhere and graft it onto the shipped sheet:

   ```powershell
   & "C:\Users\15639732925\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" `
     "C:\Users\15639732925\Documents\deepseek-harness\default-workspace\whale-shooter\ds-whale-shooter-PC\art-source\characters\tools\graft-walk.py" `
     --character qwen `
     --input "C:\path\to\img-qwen-walk-4f.png"
   ```

   The tool keys the magenta, centres every frame on its **foot centroid**, puts every sole
   on **one** baseline, resizes to the sheet's own cell size, and touches **only** frames
   4..7. It prints the stride before/after and exits non-zero if the new row is flatter than
   the one it replaced, so a bad generation cannot land quietly.
3. `pnpm test` — `tests/lib/characters/heights.test.ts` pins the drawn height at 173px.

## Why the vertical shift is uniform

Per-frame "align the soles" naively flattens the cycle: every frame gets moved down until its
lowest pixel hits the same line, which cancels the up/down part of the stride — precisely the
part that reads as walking on a long-dress character. The tool takes the **median** sole
height as one delta and moves every frame by it, so the cycle's own motion survives while the
row as a whole sits on the right baseline.

## What these generators actually hand back

The 即梦 / jimeng sheets are **2560x1440 with a rose gradient, not flat magenta**, four
characters whose arms and tails cross the cell boundaries, and a logo stamped bottom-right.
Three things in the tooling exist only because of that:

- `key_by_distance` samples the border colour and keys by distance, because a fixed magenta
  threshold leaves the vignette behind as a solid block.
- `mask_corner` paints that logo with the **sampled background colour**. Painting it magenta
  was worse than leaving it: the distance key then treated the patch as content and shipped
  it as a pink rectangle in the frame.
- every slice is inset 1.5% on each side, or the neighbour's sleeve rides into the cell.

## Files

- `claude-512-原文.png` — Claude's pre-rebuild sheet, kept for comparison.
- `prompts/` — the generation prompts (each under the generator's ~2000 character limit).
- `tools/graft-walk.py` — four walk frames into row 1 (frames 4..7).
- `tools/graft-idle.py` — one front pose into row 0, scaled to the walk row's height.
- `tools/qwen-row.py` — rebuilt Qwen's whole sheet at 768 so the new art keeps its detail.

## DeepSeek's front pose

Her idle row (frames 0..3) is the galgame mascot reference, not a generated walk frame:

```
C:\Users\15639732925\Documents\deepseek-harness\default-workspace\云端九世通信\_底板参考\_归档_五位AI娘\长相参考_鲸娘\1_主参考_idle-cute_正面站立_与galgame挂件同一张.png
```

That file is a proper cut-out (real alpha, 512x512), so it goes in with `--use-alpha`, which skips
colour keying — keying a navy dress against a black-mapped transparent background would have
eaten the dress:

```powershell
& <python> art-source/characters/tools/graft-idle.py --character deepseek `
  --input "<the reference path above>" --frame 1 --frames 1 --use-alpha
```

It is scaled to the walk row's own body height, so the idle pose and the walk frames agree.

## 行走行必须朝同一个方向（2026-10-30 修）

生成图里的四帧**朝向是随机的**：有的画成朝左，有的朝右。四帧拼成一行后，游戏再用 `flipX`
处理左右走，**结果无论往哪走都会同时出现朝左和朝右的帧**——主人报的"走路的帧不对"就是这个。

**判断朝向就看尾巴**：这条鲸鱼娘是 3/4 侧身，**尾巴在哪边，她就朝反方向**。

| 帧 | 尾巴 | 朝向 | 处理 |
| --- | --- | --- | --- |
| C1 | 左 | 朝右 | 不动 |
| C4 | 右 | 朝左 | **镜像** |
| D1 | 左 | 朝右 | 不动 |
| D4 | 右 | 朝左 | **镜像** |

`Image.transpose(FLIP_LEFT_RIGHT)` 一行就够，镜像后的帧尾巴换边、朝向也跟着换。

**别用数值指标自动判断朝向**（我试过两版：脸的重心、深色块重心，都和实际相反）——
**放大 3 倍人眼看尾巴**，这是唯一可靠的判据。定稿后整行朝右，向左走交给 `flipX`。

## 行走行：X 型腿是画出来的，改不了（2026-10-30）

5395 / 6390 两张图里所有侧身、半侧身的帧，**腿都是 X 型**（两腿交叉）。放大 3 倍确认过：
不是抠图或缩放造成的，是生成时画歪的。**像素层面无法修复一个画错的腿部结构。**

正面（朝下）那张**完美**，但裙子一直垂到鞋口，**腿被完全挡住**——试着把鞋子左右平移做出步态，
在 173px 的游戏尺寸下：

| 源图位移 | 游戏内像素 | 观感 |
| --- | --- | --- |
| 7 px | 2.4 px | 看不出来 |
| 12 px | 4.2 px | 仍然几乎看不出来 |

**结论：正面图做不出行走，侧身图腿画错了。这一行必须重新生成。**

新版提示词：`art-source/characters/prompts/img-deepseek-walk-4f-v3-legs.txt`（1727 字符，
即梦上限 2000）。相对 v2 的改动：

1. **腿必须是两根平行柱子，不许交叉、不许接触、不许成 X/K**
2. 两腿之间**留至少 6px 背景**，从裙摆到地面
3. **裙摆只到膝盖**，膝盖以下必须看得见小腿、袜子和鞋
4. 两只鞋各 ≥26px 宽，**贴地可见**，鞋底在同一条水平线上
5. **相邻角色之间留 40px 纯品红**——上一批图四个角色粘在一起，四等分和连通块都分不开

## 2026-10-30 第二版：7235 那张 + 补的向左图

新素材（都在 `D:\网页下载`）：

- `jimeng-2026-10-30-7235-…png`：四个方向位 —— ①右下 ②向右 ③正面 ④左下
- `5f82317e667e9a72375ff65f2ce68b82.jpg`：主人自己补的 **⑤纯向左**

**这一批腿是正常的**（没有 X 型），裙摆以下两条腿分开画了。所以用上了：

| 行 | 内容 | 来源 |
| --- | --- | --- |
| 静止 | ③正面 ×4 | 7235 第三格（主人说比之前那张还好） |
| 行走 | ②向右 → ⑤镜像 → ② → ⑤ | 7235 第二格 + 补的向左图 |

**⑤ 为什么要镜像**：它朝左，镜像后变成"朝右、另一条腿在前"，正好补上 ② 缺的那半步。
四帧朝向统一朝右，向左走仍交给 `flipX`。

### 两个工具坑（都踩了）

1. **`graft-idle --use-alpha` 会按 `--frames` 把输入切四份**，单帧输入必须加 `--frames 1`，
   否则只拿到左四分之一（结果是一个 27px 宽的竖条）。
2. **`graft-walk` 默认会 `mask_corner` 抹掉整条图右下角 16%×14%**。自己拼的四格条**没有水印**，
   被抹掉的是第 4 格的裙摆和尾巴 —— 表现是第 4 帧比其它帧矮 18px。
   **自己拼的条必须加 `--keep-corner`。**

### 已知瑕疵

- ⑤ 来自 **JPG、分辨率低**（309×560），量化后比 ② 略亮，且头顶发环少 6px（177 vs 183）。
  走路时表现为轻微上下浮动，暂时可接受。
- 循环是 A-B-A-B（两相位），不是四相位。

## 走路"抽风"：两帧来自两幅不同的画（2026-10-30 晚）

主人的反馈：**静止、向左、向右都没问题，走路像抽风**。

原因不是中间帧坏了，是**这两帧本来就是两幅画**：

| 帧 | 来源 | 高 | 宽 | 平均亮度 |
| --- | --- | --- | --- | --- |
| 4、5 | 7235 的 ②（PNG，1054px） | 183 | 98 | 34.1 |
| 6、7 | 主人补的 ⑤（**JPG**，480px） | 183 | **112** | **35.9** |

JPG 那张分辨率只有 309×560，头部角度、尾巴位置、整体明暗都和 ② 不同。**任何交替都会同时
把头发、尾巴、亮度一起换掉** —— 10fps 下就是每秒换 5 次，眼睛看到的是抽搐。

**做了两件事：**

1. **排成 A,A,B,B**（原先是 A,B,A,B）：姿势切换从每循环 4 次降到 **2 次**
2. **frameRate 10 → 6**：每个姿势停 0.33 秒，读起来像"迈步"而不是"闪"

**试过但没用的：**

- 想给同一姿势加 1px 上下起伏做出步态 —— `regrid` 会把每帧 bbox 归一化，**整体平移直接被吃掉**（四帧变成像素级完全相同，stride 0）
- 想用亮度补偿把 JPG 那帧拉齐 —— 补完反而更亮（35.9 → 38.3），因为之后还要过 32 色量化
- 想只换腿（身体用 ②、腿用 ⑤）—— ⑤ 只有 480px，放大 2.2 倍会糊，接缝也压不住

**真正的修法：要两帧从同一幅画里切出来的。** 新提示词
`art-source/characters/prompts/img-deepseek-walk-4f-v4-same-direction.txt` 把这条写死了 ——
**四帧必须同一个朝向，只许腿变**。上一版提示词只说了"朝右走"，模型就把四帧画成了四个方向。

## 定稿：571 那张的四个相位（2026-10-30 夜）

主人一次给了四张（`C:\Users\15639732925\Downloads`），挑中 **571**：2×2、2048×2048，
四个角色**同一个朝向（朝右）、同一幅画**，只有腿在换。这才是走路需要的素材。

**图里的两个瑕疵，都在进图集前清掉：**

| 瑕疵 | 颜色 | 处理 |
| --- | --- | --- |
| 脚下一条地面横带 | (112,0,112) 洋红 | `g<70 且 r,b>85 且 |r-b|<45` → 删（每帧 1.4~1.8 万像素） |
| 横带的亮边 / 第 4 帧脚边的白三角 | (224,200,224) 偏粉的白 | `r>180 且 g<r-25 且 g<b-25` → 删（角色身上没有这个色） |

**结果：**

| 帧 | 高 | 宽 | 底 |
| --- | --- | --- | --- |
| 4 | 182 | 133 | 187 |
| 5 | 180 | 129 | 187 |
| 6 | 183 | 133 | 187 |
| 7 | 180 | 129 | 187 |

相邻帧变化 **1278~3513 像素**（上一版两幅画交替是 4058）。**frameRate 8**。

**踩过的坑（都别再踩）：**

- 那两张图里另外三张（384 / 745 / 229）**不能用**：384 和 745 是正面，229 只切出一个角色
- 2048×2048 的图**是 2×2 不是 4×1** —— 按四等分切会把一个角色劈成两半
- 生成图会在脚下画**地面横带**，色键的采样色跟它不一样，必须按颜色单独删

## 走路帧 · 抽卡记录（截至 2026-10-30 夜，还剩 8 次）

| 版本 | 图 | 结果 |
| --- | --- | --- |
| v1~v2 | — | 腿 X 型、朝向混乱 |
| v3 | 7235 | 四个**方向**（右、右下、正面、左下），不是四相位 |
| v4 | 384/745/229/571 | 只有 571 可用：同朝向四相位，步幅 22.4。其余三张方向不对或切不出四个 |
| v4+加宽 | 2459/4747/2369 | 2459 可用但像跳；4747 只切出 3 个；2369 整张故障 |
| v5 | 1783/3823 | 1783 前后半排方向不同；3823 六个角色 3×2，步幅 43 但每帧身角都在变 |

**所以 v5 提示词（`prompts/img-deepseek-walk-4f-v5-identical-body.txt`）把"同一幅画"写成了第一原则**：

1. **四帧是同一幅画，只重画腿** —— 头、发、尾、裙、围裙、手臂、身高、间距全部一致
2. **四个腿相位逐个点名**（触地 / 通过 / 镜像触地 / 镜像通过），并明写**不许复制同一帧**
3. **禁止清单**把五次踩过的坑全列上：换视角、转头、尾巴甩边、脚下画地条、2×3 网格、腿交叉成 X
4. **间距与背景**：相邻角色之间至少 40px 纯玫红，避免连通块糊成一团

配套负面提示词：`prompts/img-deepseek-walk-4f-v5-negative.txt`（即梦有单独的负面框就贴，没有就忽略）。

**验证方式**（我这边拿到图会做的第一件事）：数连通块是不是 4 个、四帧朝向是否一致、脚下有没有洋红条、腿跨度是否 ≥380px。

## v7：把实测比例写成数字（2026-10-30 夜）

主人退回 3155 的理由是 `腿跟站着不动的腿差距太大，直接成大长腿了`。量下来：

| | 裙摆位置 | 裙摆以下裸腿 |
| --- | --- | --- |
| 静止 | 80.7% | **14.6%** |
| 走路 571 | 85~93% | 4~11% |
| 奔跑（旧行） | 61~66% | **25~31%** |
| 3155 走路 | 68~95% | 27~31% |

**同一张图里四个动作是三套比例。** 生成图普遍画成「长腿短裙」，和她的静止帧差一倍。

v7（`prompts/img-deepseek-walk-4f-v7-measured-proportions.txt`，1969 字符）把比例写成数字：

- 三头身，**裙摆落在身高的五分之四处**，下面只剩五分之一：一截小腿 + 一只小鞋
- **裙摆以下露出的皮肤不超过身高的七分之一**
- 大腿永远不露；不许长腿、短裙、迷你裙、高跟
- 附一句自检：**「如果你能看到她大部分腿，比例就错了」**

**配套参考图**：`prompts/ref-deepseek-idle-front.png` —— 从图集里切出的静止帧（597x900，玫红底）。
即梦有「参考图 / 垫图」入口的话，把这张挂上去，比例最容易对齐。

### 拿到新图后的第一道闸（我这边）

1. 连通块 = 4，朝向一致
2. **裙摆位置 ≥ 78%、裸腿 ≤ 17%**（这两条不过，比例就是错的，直接退回）
3. 脚下没有洋红/暗红横条
4. 腿之间至少 6px 空隙、不交叉

## 手翻左向走路（2026-10-30 夜，主人自己做的）

主人把走路那四帧左右镜像了，我接成**第 5 行**：

| 行 | 内容 | 帧 |
| --- | --- | --- |
| 0 | 静止 | 0~3 |
| 1 | 走路（右向） | 4~7 |
| 2 | 旧奔跑（长腿，已不用） | 8~11 |
| 3 | 闪避 | 12~15 |
| **4** | **走路（左向·手翻）** | **16~19** |

- 图集从 768×768 变成 **768×960**，`sprite.grid.rows: 5`
- YAML 加 `walkLeft`（8fps）和 `runLeft`（12fps），都带 `mirror: false`
- `walkTrackFor(facing, hasWalkLeft)` 决定播哪一行；有 `walkLeft` 时**不再翻转**
- 他给的图是**白底**（不是透明），用**从边框泛洪**抠掉——不能按颜色抠，否则会啃穿白围裙
- 帧高统一到 183、底对齐 187，颜色映射到图集现有调色板，再按行 1 的平均色做了 ±3% 校正

**这件事的教训**：正面行走没法表达左右（`朝左走没变向`），翻正面图只是换刘海和尾巴（`左右反了`）。
要么单独一行左向，要么画侧身——现在选了前者，代价是图集多一行。
