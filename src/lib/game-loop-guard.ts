/**
 * src/lib/game-loop-guard.ts
 * --------------------------------------------------------------------------
 * 让"某一帧抛异常"永远不可能把整局游戏冻死。
 *
 * 为什么需要它（2026-11-15，主人手机实测）：
 * `打死卷轴关的boss必卡死，界面不能动，但摇杆背包都正常`。那是**画布冻住、React 还活着**
 * 的典型症状 —— 主线程没卡，是 Phaser 的循环自己断了。
 *
 * Phaser 4 的循环是这么写的（`node_modules/phaser/src/dom/RequestAnimationFrame.js`）：
 *
 *     this.step = function step (time) {
 *         _this.callback(time);                                  // ← 这里抛，下一行就不执行了
 *         if (_this.isRunning) {
 *             _this.timeOutID = window.requestAnimationFrame(step);
 *         }
 *     };
 *
 * 也就是说：**下一帧是在回调跑完之后才预约的**。回调里任何一个异常冒出来，RAF 链就断在那一帧，
 * 之后再没有人预约新帧 —— 画布停在最后一帧，而 DOM/React 完全正常。这正是"摇杆能动、画面不动"。
 *
 * 我们原本只在 `scene.events.on('update')` 外面包了 try/catch（见 `scene.ts`，那次是为了
 * `打完半神·Claude还卡死了`）。但**计时器回调、补间回调、物理步、渲染**都不经过那个 handler，
 * 它们抛出去一样是冻死。
 *
 * 所以这里在真正的地基上包一层：把交给 RAF 的那个回调本身套上 try/catch。这样无论异常来自
 * 场景、计时器、补间还是渲染，最坏结果都只是"这一帧白跑"，下一帧照常。
 *
 * 记录走 `recordCrash`（落 localStorage），并回调一次 `onCrash` 让界面把它显示出来 —— 否则
 * 我们永远只能听主人描述"又卡了"，而不知道是哪一行。
 */

import { recordCrash } from '@/lib/dev/crash-log';

/** 同一句报错在这个间隔内只上报一次，免得每帧刷屏撑爆 localStorage 和界面。 */
export const LOOP_CRASH_REPEAT_MS = 1500;

export type FrameCallback = (time: number) => void;

/** 主循环活下来的那次异常。 */
export interface LoopCrash {
    message: string;
    context: string;
    /** 调用栈，给屏幕上的「详情」用 —— 真机没有 devtools。 */
    stack?: string;
}

/** 只依赖用到的那几个成员，方便单测造假对象。 */
interface RafLike {
    callback?: FrameCallback;
    // Phaser 的签名是 `start(callback, forceSetTimeOut, delay)`；这里只关心第一个参数，
    // 其余原样转发，所以放宽成任意参数。
    start?: (...args: any[]) => any;
}

interface GameLike {
    loop?: { raf?: RafLike };
}

/**
 * 给主循环装上兜底。
 *
 * @returns 卸载函数（把 RAF 还原成原样），测试和热重载用。
 */
export function installLoopGuard(
    game: GameLike | null | undefined,
    onCrash?: (crash: LoopCrash) => void,
): () => void {
    const raf = game?.loop?.raf;
    if (!raf || typeof raf.callback !== 'function') return () => {};

    const originalCallback = raf.callback;
    const originalStart = raf.start;

    let lastKey = '';
    let lastAt = 0;

    const guard = (cb: FrameCallback): FrameCallback => {
        return (time: number): void => {
            try {
                cb(time);
            } catch (error) {
                // Throttle BEFORE recording: a fault that repeats every frame must not write
                // localStorage 60 times a second.
                const message = error instanceof Error ? error.message : String(error);
                const now = Date.now();
                if (message === lastKey && now - lastAt < LOOP_CRASH_REPEAT_MS) return;
                lastKey = message;
                lastAt = now;

                const record = recordCrash(error, 'game:loop');
                // 上报本身也要是安全的：它跑在一个刚刚失败过的帧里。
                try {
                    onCrash?.({ message: record.message, context: record.context, stack: record.stack });
                } catch {
                    /* 界面的锅不能反过来再砸一次循环 */
                }
            }
        };
    };

    // ① 已经交给 RAF 的那个回调（游戏启动时就 set 好了）。
    const guarded = guard(originalCallback);
    raf.callback = guarded;

    // ② 之后每一次 start()。Phaser 在 pause/resume、切后台回来时都会重新 bind 一个新的
    //    `this.step`，所以只在上面那一处包是不够的 —— 得把边界本身包住。
    if (typeof originalStart === 'function') {
        raf.start = function patchedStart(this: unknown, ...args: any[]) {
            if (typeof args[0] === 'function') {
                args[0] = guard(args[0] as FrameCallback);
            }
            return originalStart.apply(this, args);
        };
    }

    return () => {
        raf.callback = guarded === raf.callback ? originalCallback : raf.callback;
        if (typeof originalStart === 'function') {
            raf.start = originalStart;
        }
    };
}