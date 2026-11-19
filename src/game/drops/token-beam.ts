/**
 * src/game/drops/token-beam.ts
 * --------------------------------------------------------------------------
 * 词元盾落地时那道**光柱**：`传奇`游戏里装备落地那种，不是一块发光的板子。
 *
 * 主人 2026-11-14：`现在的光柱，有点"1毛特效了"`，要「5毛特效」——狂绚酷拽、会呼吸、有上浮
 * 光粒、有旋转符环、有地面冲击圈。
 *
 * 做法是**预渲染序列帧**（方案 A）：素材是 8×6=48 帧的循环，画的时候就把内芯、边光、上升
 * 光带、火花十字星、两圈反向旋转符环、外扩冲击波全画进去了，运行时只是一张贴图在播。
 *
 * 选它而不是 shader 的理由：手机 WebView 跑 Phaser 4 自定义 pipeline 兼容性参差，出问题就是
 * 黑块或不显示（我们刚被"贴图不显示"坑过一次）；而序列帧在低端机上就是一张图，稳。
 *
 * 一张近白偏暖的图，靠 `setTint` 变三种色调，所以加配色不用重出图。
 */

import {
    BLEND_MODE_ADD,
    BLEND_MODE_NORMAL,
    tokenPillarPalette,
    type TokenPillarPalette,
    type TokenPillarTone,
} from '@/lib/constants';

/** 贴图 key（缓存里唯一，别和 drops.png 撞）。 */
export const TOKEN_BEAM_TEXTURE = 'token-beam-sheet';

/** 放在 `public/` 下的路径。 */
export const TOKEN_BEAM_PATH = 'assets/image/drops/token-beam.png';

/** 单帧尺寸（设计像素）。 */
export const TOKEN_BEAM_FRAME = { width: 128, height: 288 } as const;

/** 序列帧规格：8 列 × 6 行。 */
export const TOKEN_BEAM_SHEET = { cols: 8, rows: 6 } as const;

export const TOKEN_BEAM_FRAME_COUNT = TOKEN_BEAM_SHEET.cols * TOKEN_BEAM_SHEET.rows;

/** 播放帧率。18fps × 48 帧 ≈ 2.7 秒一轮循环。 */
export const TOKEN_BEAM_FPS = 18;

/** 动画 key。 */
export const TOKEN_BEAM_ANIM = 'token-beam';

/**
 * 贴图缩放（纵向）。
 *
 * 单帧 128×288，缩到 0.9 之后柱身约 115×259。
 */
export const TOKEN_BEAM_SCALE = 0.9;

/**
 * 横向缩放。
 *
 * 主人 2026-11-15：`光柱直径窄了点，扩大一半。高度可以，高度不用调`。
 * 所以只拉宽，不动高度：0.9 × 1.5 = 1.35，柱身约 173×259。
 */
export const TOKEN_BEAM_SCALE_X = TOKEN_BEAM_SCALE * 1.5;

/**
 * 这张光柱图要不要加载 —— 按需，别让普通关卡白下载一张 48 帧的图。
 *
 * **两个条件任一成立就要加载**：
 *   1. 掉落物自己声明了 `beam`（加冕之冠走这条）；
 *   2. 词元盾（`token-shield`）—— 它没写 `beam`，颜色跟着关卡深浅走。
 *
 * 2026-11-17 的 bug：这里原来只认 `token-shield`，于是隐藏地图上的加冕之冠
 * **根本没加载这张图**，`createTokenBeam` 走了退化路径（一根纯色矩形）——
 * 主人一眼就看出来：`为什么没有那些花里胡哨的特效？词元盾和白龙獠牙特效都很足啊`。
 */
export function levelNeedsTokenBeam(
    specs: Iterable<{ beam?: unknown; effect?: { type: string } }>,
): boolean {
    for (const spec of specs) {
        if (spec.beam) return true;
        if (spec.effect?.type === 'token-shield') return true;
    }
    return false;
}

/** 排队加载光柱序列帧。 */
export function loadTokenBeam(scene: Pick<Phaser.Scene, 'load'>): void {
    scene.load.spritesheet(TOKEN_BEAM_TEXTURE, `/${TOKEN_BEAM_PATH}`, {
        frameWidth: TOKEN_BEAM_FRAME.width,
        frameHeight: TOKEN_BEAM_FRAME.height,
    });
}

/**
 * 建动画。
 *
 * **不能只做 `if (exists) return`** —— 动画是全局的（`scene.anims` 跨场景共用），
 * 但贴图是按场景加载、离开场景时被 `releaseLoadedTextures` 移除的：
 *
 *   1. 进关 → 加载 `token-beam-sheet` → 建动画，帧指向这一份贴图的 Frame；
 *   2. 离关 → `textures.remove(key)` → 那些 Frame 全部 `destroy()`，`frame.data = null`；
 *   3. 再进关（或者原地重开）→ `exists` 仍为真 → 跳过重建 → 光柱播的还是上一份死帧
 *      → 渲染时读 `frame.sourceSize` 就是 `Cannot read property 'sourceSize' of null`。
 *
 * 这和守关 boss 的怪物动画是同一个坑，`createMonsterAnims` 的做法是先 `remove` 再 `create`，
 * 这里照同一套路：帧还活着就复用，死了就重建。
 */
export function ensureTokenBeamAnim(
    scene: Pick<Phaser.Scene, 'anims'>,
    frames: number = TOKEN_BEAM_FRAME_COUNT,
): void {
    const existing = scene.anims.exists(TOKEN_BEAM_ANIM)
        ? (scene.anims.get(TOKEN_BEAM_ANIM) as unknown as { frames?: { frame?: { data?: unknown } }[] })
        : undefined;

    const framesAreLive =
        !!existing?.frames &&
        existing.frames.length === frames &&
        existing.frames.every((f) => !!f?.frame?.data);

    if (framesAreLive) return;
    if (existing) scene.anims.remove(TOKEN_BEAM_ANIM);

    scene.anims.create({
        key: TOKEN_BEAM_ANIM,
        frames: Array.from({ length: frames }, (_, i) => ({ key: TOKEN_BEAM_TEXTURE, frame: i })),
        frameRate: TOKEN_BEAM_FPS,
        repeat: -1,
    });
}

/**
 * 光柱的三种颜色。主人 2026-11-14 的分工：
 *   `金色光柱配给词元盾，紫色光柱配给白龙獠牙，白色光柱留着，给我们未至之境的道具预备着`。
 *
 * 2026-11-17 主人把第三道（白）指定给了**加冕之冠**：
 *   `我们之前做了3个"5毛特效"，词元盾用了一个，白龙獠牙用了一个，剩下一个用在这里`。
 * 三道至此各有其主：金 = 词元盾、紫 = 白龙獠牙、白 = 加冕之冠。
 * 未至之境的道具将来要光柱，得再定一色。
 *
 * 它和关卡的 `tokenPillarTone` 是两件事：那个说的是"这张地图背景亮不亮"，这个说的是
 * "这件掉落物值多少面子"。物品自己带颜色，换关卡不掉色。
 */
export type BeamTone = 'gold' | 'violet' | 'bright';

export const BEAM_TONES: readonly BeamTone[] = ['gold', 'violet', 'bright'];

/**
 * 光柱色 -> 调色板里的那一套。
 *
 * `violet` 借的是 `dark` 那套（0x8b5cf6，正是紫罗兰）；`bright` 是薰衣草白，留给未至之境。
 */
export function beamPalette(tone: BeamTone): TokenPillarPalette {
    return tone === 'violet'
        ? tokenPillarPalette('dark')
        : tone === 'gold'
          ? tokenPillarPalette('gold')
          : tokenPillarPalette('bright');
}

/** 调色板里那道光的颜色（tint 用）。 */
export function beamTint(tone: BeamTone | TokenPillarTone | undefined): number {
    return tone === 'gold' || tone === 'violet' || tone === 'bright'
        ? beamPalette(tone).fill
        : tokenPillarPalette(tone).fill;
}

/**
 * 一件掉落物该用哪一色光柱。
 *
 * 优先级：物品自己写的 `beam` > 关卡原来的深浅设置（只有词元盾走这条老路）。
 * 没写就不画柱，普通掉落不会突然长出一道光。
 */
export function beamToneFor(
    specBeam: BeamTone | undefined,
    weaponBeam: BeamTone | undefined,
    levelTone: TokenPillarTone | undefined,
    isTokenShield: boolean,
): BeamTone | null {
    if (specBeam) return specBeam;
    if (weaponBeam) return weaponBeam;
    if (!isTokenShield) return null;
    // 老数据：词元盾没写 beam 时，按关卡的深浅走（gold / dark / bright）。
    return levelTone === 'gold' ? 'gold' : levelTone === 'dark' ? 'violet' : 'bright';
}

/**
 * 地面光斑的尺寸。
 *
 * 柱身 2026-11-15 加宽到 1.5 倍（173px），光斑不跟着变宽就会显得头重脚轻，所以同步 ×1.5；
 * 高度不动（主人只要求柱身加宽，高度保持原样）。
 */
export const TOKEN_BEAM_GLOW = { width: 144, height: 28 } as const;

/** 光柱的两个对象：柱身（序列帧）与地面光斑。 */
export interface TokenBeamHandles {
    beam: Phaser.GameObjects.Sprite;
    glow: Phaser.GameObjects.Ellipse;
}

/**
 * 把光柱摆到地上。
 *
 * 贴图没加载出来时**退回旧的那根矩形**：一个看不见的掉落比一个丑的掉落糟得多，而我们刚刚
 * 才被"贴图没加载 → 立绘不显示"坑过一次（`8f58402`）。
 */
export function createTokenBeam(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tone: BeamTone,
): TokenBeamHandles {
    const palette = beamPalette(tone);
    // 数字常量，不是 `Phaser.BlendModes` —— 见 `constants.ts` 里的说明：这个模块不该为了
    // 两个整数把整个引擎 import 进来，当初漏了 import 就是这么炸的。
    const blend = palette.useAdditive ? BLEND_MODE_ADD : BLEND_MODE_NORMAL;
    const depth = Math.round(y) - 1;

    ensureTokenBeamAnim(scene);

    let beam: Phaser.GameObjects.Sprite;
    if (scene.textures.exists(TOKEN_BEAM_TEXTURE)) {
        beam = scene.add.sprite(x, y, TOKEN_BEAM_TEXTURE);
        beam.setOrigin(0.5, 1);
        beam.setScale(TOKEN_BEAM_SCALE_X, TOKEN_BEAM_SCALE);
        beam.setTint(palette.fill);
        beam.setBlendMode(blend);
        beam.setDepth(depth);
        beam.play(TOKEN_BEAM_ANIM);
        // 序列帧本身已经在呼吸，这里只叠一层很轻的整体亮度起伏。
        scene.tweens.add({
            targets: [beam],
            alpha: { from: 0.82, to: 1 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
    } else {
        // 退化路径：旧矩形，至少让人看见"这里有东西"。
        const rect = scene.add.rectangle(x, y, 60, 210, palette.fill, palette.fillAlpha);
        rect.setOrigin(0.5, 1);
        rect.setBlendMode(blend);
        rect.setDepth(depth);
        beam = rect as unknown as Phaser.GameObjects.Sprite;
    }

    const glow = scene.add.ellipse(
        x,
        y,
        TOKEN_BEAM_GLOW.width,
        TOKEN_BEAM_GLOW.height,
        palette.glow,
        palette.glowAlpha,
    );
    glow.setBlendMode(blend);
    glow.setDepth(depth);
    scene.tweens.add({
        targets: [glow],
        scaleX: { from: 0.85, to: 1.15 },
        scaleY: { from: 0.85, to: 1.15 },
        alpha: { from: 0.5, to: 0.9 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
    });

    return { beam, glow };
}
