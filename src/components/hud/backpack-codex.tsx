/**
 * src/components/hud/backpack-codex.tsx
 * --------------------------------------------------------------------------
 * 背包底部的【图鉴】：一个按钮 + 一页"道具：效果"。
 *
 * 主人 2026-11-15：`在背包底部的数量 XXXX/XXXX 后面添加一个【图鉴】按钮，悬停或者点击都出一个
 * 弹框（复用词元盾的弹框样式就行，写各项道具的介绍，简单样式即可，每一行的样式 道具：效果`。
 *
 * 词元盾那个弹框的样式就是这里的出处：`border-2 border-violet-400/80 bg-stone-950/95`
 * 加一层黑阴影（见 `token-shield-badge.tsx`）。
 *
 * 悬停给桌面，点击给手机（没有 hover），键盘回车也能开 —— 三种都一样。
 */

import React from 'react';

export interface CodexRow {
    id: string;
    /** 道具名（已按语言选好）。 */
    label: string;
    /** 效果那一句（已按语言选好）。 */
    effect: string;
}

export interface BackpackCodexProps {
    rows: CodexRow[];
    /** 测试用：直接展开。 */
    defaultOpen?: boolean;
    /** 空列表时的那句话。 */
    emptyText: string;
    /** 标题。 */
    titleText: string;
    /** 按钮上的字。 */
    buttonText: string;
}

export const BackpackCodex: React.FC<BackpackCodexProps> = ({
    rows,
    defaultOpen = false,
    emptyText,
    titleText,
    buttonText,
}) => {
    const [open, setOpen] = React.useState(defaultOpen);

    return (
        <span className="relative">
            <button
                type="button"
                data-testid="backpack-codex-button"
                aria-expanded={open}
                className="border border-stone-600 bg-stone-900 px-2 py-0.5 text-[11px] tracking-wider text-stone-300 transition-colors hover:border-violet-500 hover:text-violet-200"
                onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setOpen(true);
                }}
                onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setOpen(false);
                }}
                onClick={() => setOpen((v) => !v)}
            >
                {buttonText}
            </button>

            {open && (
                <span
                    data-testid="backpack-codex-panel"
                    className="absolute bottom-full right-0 z-[45] mb-2 block max-h-[320px] w-[360px] overflow-auto border-2 border-violet-400/80 bg-stone-950/95 px-3 py-2 text-left font-['Silkscreen',monospace] text-[12px] leading-relaxed text-violet-100 shadow-[0_4px_16px_rgba(0,0,0,0.7)]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="mb-1 block font-bold text-violet-200">{titleText}</span>
                    {rows.length === 0 && (
                        <span className="block text-violet-100/70">{emptyText}</span>
                    )}
                    {rows.map((row) => (
                        <span key={row.id} data-codex-row className="block">
                            <span className="text-violet-50">{row.label}</span>
                            <span className="text-violet-100/60">：</span>
                            <span className="text-violet-100/85">{row.effect}</span>
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
};