/**
 * src/lib/levels/run-time.ts
 * --------------------------------------------------------------------------
 * 「通关用时」怎么算 —— 四张图 = 一条链，要加起来。
 *
 * 背景（主人 2026-11-16）：以前一个大关是一张超大图，末关结算时读到的用时就是整关的用时。
 * 后来超大图拆成 2×2 的四张 level，结算仍然只在第四张（`bossPhase: 4`）触发，
 * 于是那行「用时」只剩最后一张图的时长 —— 一个跑了四十分钟的玩家看到「用时 06:12」。
 *
 * 主人给的选项：直接去掉，或者四关加起来。选了后者：这行数字玩家会截图，
 * 去掉等于丢掉一个成就，加起来才对得上他心里的「我这关打了多久」。
 *
 * 做法：每张图通关时把自己的用时记进 store（`levelClearMs`，按 levelId 存，跨重启保留），
 * 末关结算时把**同一个 chapter 前缀**下所有记录加起来。levelId 的命名是
 * `<chapter>-<序号>-<名字>`（`warhammer-redeem-3-fireworks`），所以前缀就是 chapter。
 */

/**
 * `warhammer-redeem-3-fireworks` → `warhammer-redeem`
 *
 * 没有 `<序号>-` 尾巴的 id（`beach-holiday`、`tavern`）返回它自己。
 */
export function levelChapter(levelId: string): string {
    // 块名里自己带连字符（`-first-meeting`），所以尾巴用 `.+` 而不是 `[^-]+`；
    // 非贪婪，取**第一个** `<数字>-`，chapter 名里不会出现这种片段。
    const match = /^(.*?)-\d+-.+$/.exec(levelId);
    return match ? match[1] : levelId;
}

/**
 * 这一章到目前为止的累计用时（ms）。
 *
 * 只统计**同一 chapter 前缀**的记录，并且忽略坏值 —— 存档里可能残留上一次运行的数字，
 * 那也不该让结算页显示 `NaN`。
 */
export function chapterRunMs(times: Readonly<Record<string, number>>, levelId: string): number {
    const chapter = levelChapter(levelId);
    let total = 0;
    for (const [id, ms] of Object.entries(times)) {
        if (levelChapter(id) !== chapter) continue;
        if (!Number.isFinite(ms)) continue;
        total += Math.max(0, Math.round(ms));
    }
    return total;
}