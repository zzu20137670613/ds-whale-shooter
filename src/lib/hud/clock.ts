/**
 * src/lib/hud/clock.ts
 * --------------------------------------------------------------------------
 * `MM:SS`, zero-padded, capped at 99:59.
 *
 * 两处都用它：屏幕顶部那块关卡标题牌（`scene-hub-overlay`），和存档界面里当缩略图用的
 * 同名小牌子（`save-slot-plate`，主人 2026-11-16 说截图缩成 111×64 太糊，直接用这块牌子
 * 代替）。同一个数字在两处显示成两种样子会很怪，所以格式只写一次。
 */

export function formatMmSs(ms: number): string {
    const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const totalSec = Math.floor(safe / 1000);
    const mm = Math.min(99, Math.floor(totalSec / 60));
    const ss = totalSec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}