import React from 'react';
import { formatMmSs } from '@/lib/hud/clock';
import { useGameStore } from '@/store/game-store';

import { CornerPixels, RETRO_BOX } from './retro-box';

export const SceneHubOverlay: React.FC = () => {
    const { levelTitle, levelElapsedMs } = useGameStore();

    if (!levelTitle) return null;

    return (
        <div
            className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none flex font-['Silkscreen',monospace]"
            // 主人 2026-11-15：`最后一关顶端的样式跑偏了，地图名字没有居中`。
            // 名字越长牌子越宽，右边就会顶到词元盾那块徽章底下（它 z 更高），看起来既没居中
            // 又被切掉。这里给牌子一个上限宽度、名字超了就省略号，两头留出徽章的位置。
            style={{ maxWidth: 'min(58vw, 560px)' }}
        >
            {/* Retro Pixel Box - Dark Outer Border + Amber Accent Corners */}
            <div className={`${RETRO_BOX} relative flex min-w-0 items-center gap-3 px-5 py-2`}>
                <CornerPixels />

                <div className="flex min-w-0 flex-col items-center gap-0.5">
                    {/*
                     * NOTE the explicit `font-mono` on the title: both bundled
                     * pixel faces (Silkscreen, Press Start 2P) are caps-only —
                     * they have no lowercase glyphs at all, so "Claude" renders
                     * as "CLAUDE" no matter what text-transform says. The title
                     * is the one label in the HUD that must keep its authored
                     * case (proper nouns: Claude / GPT / dsh), so it opts out of
                     * the pixel face. Everything else stays on Silkscreen.
                     */}
                    <span
                        className="w-full truncate text-center font-mono text-sm font-bold tracking-wider text-amber-500 drop-shadow-[1px_1px_0px_#000] leading-tight"
                        title={levelTitle}
                    >
                        {levelTitle}
                    </span>
                    <span className="text-[10px] text-white tracking-widest font-semibold leading-none mt-1 drop-shadow-[1px_1px_0px_#000]">
                        {formatMmSs(levelElapsedMs)}
                    </span>
                </div>
            </div>
        </div>
    );
};
