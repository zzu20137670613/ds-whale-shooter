/**
 * tests/game/scenes/update-guards.test.ts
 * --------------------------------------------------------------------------
 * 场景的每帧更新必须**分块兜底**，不能共用一个大 try。
 *
 * 2026-11-15 手机现场就是这么被坑的：`BossArenaLoop.movePlayer` 抛了
 * `Cannot read property 'setPosition' of undefined`，而「踩饭盆的提示」的判定排在它后面 ——
 * 于是饭盆进了包、提示永远不来，主人只看到一句`没触发文字提示`。
 *
 * 这里只验结构：update 处理器里每个子系统都得包在 `guard('…')` 里。真正的行为测试在
 * `tests/game/physics/matter-body.test.ts`（修掉那个抛异常的地方）。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(join(process.cwd(), 'src', 'game', 'scenes', 'scene.ts'), 'utf8');

/** 从 `this.events.on('update'` 到下一个顶层注释块之间的那一段。 */
function updateHandler(): string {
    const start = SOURCE.indexOf("this.events.on('update'");
    expect(start, "找不到 update 处理器").toBeGreaterThan(-1);
    const end = SOURCE.indexOf("// Tell the editor panel", start);
    expect(end, '找不到 update 处理的结尾').toBeGreaterThan(start);
    return SOURCE.slice(start, end);
}

describe('the scene update handler', () => {
    const body = updateHandler();

    it('guards every subsystem it drives', () => {
        // 这些是曾经或可能单独出事的子系统；任何一个没被 guard 包住，一处异常就会连带
        // 饿死下面所有子系统。
        for (const label of [
            'monsters',
            'pointers',
            'spawner',
            'sweep',
            'drops',
            'triggers',
            'interactables',
            'materials',
            'teleporters',
            'save',
            'victory',
        ]) {
            expect(body, `${label} 没有自己的 guard`).toContain(`guard('${label}'`);
        }
    });

    it('does not put the whole frame inside one try', () => {
        // 一个 try + 一堆调用正是出事前的写法。
        expect(body).not.toContain('} catch (error) {\n                recordCrash(error, \'scene:update\');');
    });

    it('keeps the bowl walk-in check inside its own guard', () => {
        // 就是这一块当年被 boss 走位连带吞掉。
        const at = body.indexOf("guard('interactables'");
        expect(at).toBeGreaterThan(-1);
        const block = body.slice(at, body.indexOf("guard('materials'", at));
        expect(block).toContain('walkInto');
        expect(block).toContain('runInteractable');
    });
});