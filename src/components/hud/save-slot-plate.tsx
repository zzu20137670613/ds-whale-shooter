/**
 * src/components/hud/save-slot-plate.tsx
 * --------------------------------------------------------------------------
 * 存档格里那块「地图名小牌子」，代替截图缩略图。
 *
 * 主人 2026-11-16：`关于存档界面是有个黑框的，那个黑框如果说截屏保留的话会很小显示效果很差，
 * 那我们可不可以偷个懒，直接把地图名那个小格子当作存档界面给存进去显示（至少比现在的黑框强）`。
 *
 * 为什么这比截图强：
 *   · 截图是 160×90 的 JPEG，塞进 84px 高的格子里再放大，糊成一团黑；
 *   · 这块牌子是**现渲染**的 —— 存档里本来就存了 `levelTitle` 和 `elapsedMs`，
 *     不需要图片，也不占 localStorage（每格省下 5～10 KB 的 data URL）；
 *   · 任何 DPI 下都是脆的像素字，和游戏里的标题牌一模一样。
 */

import React from 'react';

import { formatMmSs } from '@/lib/hud/clock';

const CORNER_SIZE = '3px';

/** 四角的小像素点，和游戏里那块标题牌同款。 */
const Corners: React.FC = () => (
    <>
        {(
            [
                ['top-0 left-0', 'border-t border-l'],
                ['top-0 right-0', 'border-t border-r'],
                ['bottom-0 left-0', 'border-b border-l'],
                ['bottom-0 right-0', 'border-b border-r'],
            ] as const
        ).map(([position, edges]) => (
            <span
                key={position}
                aria-hidden
                className={`absolute ${position} ${edges}`}
                style={{
                    width: CORNER_SIZE,
                    height: CORNER_SIZE,
                    borderColor: 'rgba(245, 158, 11, 0.9)',
                }}
            />
        ))}
    </>
);

export interface SaveSlotPlateProps {
    /** 关卡名，例如「海边亭台」。截断到一行。 */
    title: string;
    /** 关卡内计时，显示成 MM:SS。 */
    elapsedMs: number;
}

export const SaveSlotPlate: React.FC<SaveSlotPlateProps> = ({ title, elapsedMs }) => (
    <div
        data-testid="save-slot-plate"
        className="relative flex w-full flex-col items-center justify-center gap-0.5 rounded-sm border border-amber-900/70 bg-stone-950/85 px-1 py-1 font-['Silkscreen',monospace]"
    >
        <Corners />
        <span className="w-full truncate text-center text-[13px] font-bold leading-tight tracking-wider text-amber-500 drop-shadow-[1px_1px_0px_#000]">
            {title}
        </span>
        <span className="text-[11px] font-semibold leading-none tracking-widest text-stone-100 drop-shadow-[1px_1px_0px_#000]">
            {formatMmSs(elapsedMs)}
        </span>
    </div>
);