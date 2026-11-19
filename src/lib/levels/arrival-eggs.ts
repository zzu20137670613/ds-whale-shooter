/**
 * src/lib/levels/arrival-eggs.ts
 * --------------------------------------------------------------------------
 * 「一进这张图就发生」的彩蛋。
 *
 * 主人 2026-11-15 定的最终形态：
 *   `进入boss战第四关自动出第一句的提示，背包多个白米饭，重复刷boss关再出第二句提示`。
 *
 * 之前试过"走进去触发"，网页上实测还是不灵（进图不响、走到饭盆上也不响）。这一版不再靠
 * 位置判定：关卡 YAML 里写 `trigger: enter`，读图时就把动作放一次 —— 第一次来是
 * 「白米饭已经收进背包」，再来一次是「已经在包里了」。判定只剩"是不是第一次拿到"，
 * 那件事 `runInteractable` 一直做得对。
 */

import type { z } from 'zod';

import type { InteractableSchema } from './schema';

/** 关卡里的一个互动体（`interactables` 的元素）。 */
type Interactable = z.infer<typeof InteractableSchema>;

/** 关卡里所有 `trigger: enter` 的动作，按 YAML 顺序。 */
export function arrivalActions(level: { interactables?: Interactable[] }): string[] {
    return (level.interactables ?? [])
        .filter((entry) => entry.trigger === 'enter')
        .map((entry) => entry.action);
}