/**
 * src/components/hud/crash-banner.tsx
 * --------------------------------------------------------------------------
 * 主循环兜底接住异常之后，把**那句话本身**摆到屏幕上；点「详情」能看到调用栈。
 *
 * 为什么要有「详情」：手机上只有一句话不够定位（2026-11-15 的
 * `scene:update: Cannot read property 'setPosition' of undefined` 就属于这种 ——
 * 名字对得上，但不知道是谁在调用）。栈早就落在 localStorage 里了（见 `lib/dev/crash-log`），
 * 只是没人读得出来。真机没有 devtools，所以这里把它摆到屏幕上。
 *
 * 顺带一件事：**上次的崩溃也会显示**。横幅挂载时如果没有实时崩溃，就读一遍存过的记录 ——
 * 这样装完新包不用复现，直接点「详情」就能看到上一次的栈。
 *
 * 颜色用告警红而不是提示琥珀：这是"出错了但活下来了"，不是"游戏做了点啥"。
 */

import React from 'react';

import { ackCrashes, crashAckAt, crashBootAt, readCrashes } from '@/lib/dev/crash-log';
import { useGameStore } from '@/store/game-store';

/** 只露一行，长的截断 —— 完整栈在「详情」里。 */
export const CRASH_MESSAGE_MAX = 160;

/** 详情里最多显示多少行栈（够看到调用方就行）。 */
export const CRASH_STACK_LINES = 8;

export interface CrashShown {
    message: string;
    context: string;
    stack?: string;
}

/** 可单独渲染的视觉，方便测试。 */
export const CrashBannerView: React.FC<{ crash: CrashShown; onDismiss: () => void }> = ({
    crash,
    onDismiss,
}) => {
    const [open, setOpen] = React.useState(false);
    const raw = `${crash.context}: ${crash.message}`;
    const text = raw.length > CRASH_MESSAGE_MAX ? `${raw.slice(0, CRASH_MESSAGE_MAX - 1)}…` : raw;
    const frames = (crash.stack ?? '')
        .split('\n')
        .slice(0, CRASH_STACK_LINES)
        .join('\n');

    return (
        <div
            className="pointer-events-none absolute inset-x-0 top-2 z-[60] flex justify-center px-2"
            data-testid="crash-banner"
        >
            <div className="pointer-events-auto flex max-w-[92%] flex-col gap-1 border-2 border-red-500/90 bg-stone-950/95 px-3 py-2 font-mono text-red-200 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
                <div className="flex items-start gap-3">
                    <span style={{ fontSize: '14px' }} data-testid="crash-text">
                        游戏内部报错，已自动接住：{text}
                    </span>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="shrink-0 border border-red-500/70 px-2 py-0.5 text-red-100"
                        style={{ fontSize: '14px' }}
                        data-testid="crash-detail"
                    >
                        {open ? '收起' : '详情'}
                    </button>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="shrink-0 border border-red-500/70 px-2 py-0.5 text-red-100"
                        style={{ fontSize: '14px' }}
                        data-testid="crash-dismiss"
                    >
                        知道了
                    </button>
                </div>
                {open && (
                    <pre
                        className="max-h-40 overflow-auto whitespace-pre-wrap break-all border-t border-red-500/40 pt-1 text-red-300"
                        style={{ fontSize: '11px' }}
                        data-testid="crash-stack"
                    >
                        {frames || '（这条没有栈）'}
                    </pre>
                )}
            </div>
        </div>
    );
};

export const CrashBanner: React.FC = () => {
    const crash = useGameStore((s) => s.lastCrash);
    const dismissCrash = useGameStore((s) => s.dismissCrash);

    // 本次页面里还没来得及看的那条崩溃（比如崩溃发生在 HUD 挂载之前）。
    //
    // 三条过滤，缺一条都会让人误判：
    //   · `at <= crashAckAt()`：点过「知道了」的不再弹；
    //   · `at < crashBootAt()`：**上一轮会话**存下的不弹 —— 硬刷新之后还挂着旧崩溃，
    //     会让人以为修复没生效（主人 2026-11-16 就撞上了这个）；
    // 旧记录仍留在 localStorage 里，取证时用 `formatCrash` 读。
    const [stored] = React.useState<CrashShown | null>(() => {
        const [latest] = readCrashes();
        if (!latest || latest.at <= crashAckAt()) return null;
        if (latest.at < crashBootAt()) return null;
        return { message: latest.message, context: latest.context, stack: latest.stack };
    });
    const [storedDismissed, setStoredDismissed] = React.useState(false);

    if (crash) {
        return <CrashBannerView crash={crash} onDismiss={dismissCrash} />;
    }
    if (stored && !storedDismissed) {
        return (
            <CrashBannerView
                crash={stored}
                onDismiss={() => {
                    useGameStore.getState().dismissCrash();
                    ackCrashes();
                    setStoredDismissed(true);
                }}
            />
        );
    }
    return null;
};