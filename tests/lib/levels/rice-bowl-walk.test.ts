/**
 * tests/lib/levels/rice-bowl-walk.test.ts
 * --------------------------------------------------------------------------
 * 饭盆彩蛋最后定在"进图就触发"（主人 2026-11-15：`进入boss战第四关自动出第一句的提示，
 * 背包多个白米饭，重复刷boss关再出第二句提示`）。之前两次尝试都失败过：
 *   - 2026-11-14 它是个点击目标（走到铁盆那里没反应）；
 *   - 2026-11-15 改成走进黄圈，实测进图就响、真去踩反而没反应。
 * 所以这一条钉两件事：YAML 里是 `trigger: enter`，而且它出现在"进图动作"名单里；
 * 位置判定（walkInto）对它必须永远返回空。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import { arrivalActions } from '@/lib/levels/arrival-eggs';
import { RICE_BOWL_ACTION } from '@/lib/levels/easter-eggs';
import { InteractableController } from '@/game/scenes/interactable';

const ROOT = process.cwd();

/** 解析好的初遇之地。 */
function levelUnderTest() {
    const yaml = readFileSync(
        join(ROOT, 'public', 'data', 'levels', 'warhammer-redeem-4-first-meeting.yaml'),
        'utf8',
    );
    return parseLevelYaml(yaml, 'warhammer-redeem-4-first-meeting');
}

function bowlController(): InteractableController {
    const yaml = readFileSync(
        join(ROOT, 'public', 'data', 'levels', 'warhammer-redeem-4-first-meeting.yaml'),
        'utf8',
    );
    const level = parseLevelYaml(yaml, 'warhammer-redeem-4-first-meeting');
    return new InteractableController(level.interactables);
}

describe('the rice bowl on 初遇之地', () => {
    it('is an arrival egg, not a zone you have to find', () => {
        // 主人 2026-11-15：`进入boss战第四关自动出第一句的提示……重复刷boss关再出第二句提示`。
        const level = levelUnderTest();
        const bowl = level.interactables?.find((i) => i.action === RICE_BOWL_ACTION);
        expect(bowl, '饭盆互动体不见了').toBeTruthy();
        expect(bowl?.trigger).toBe('enter');
    });

    it('is picked up by the arrival list', () => {
        expect(arrivalActions(levelUnderTest())).toContain(RICE_BOWL_ACTION);
    });

    it('no longer depends on standing anywhere in particular', () => {
        // 位置判定彻底退出：站在饭盆正中、站在出生点、站在地图角落，walkInto 都不该响。
        const ctrl = bowlController();
        for (const [x, y] of [
            [2946, 1517],
            [3100, 1600],
            [500, 500],
        ]) {
            expect(ctrl.walkInto(x, y), `${x},${y}`).toBeNull();
        }
    });

    it('is actually fired by the scene when the level loads', () => {
        // 数据对了不算数：场景读图时得真的把 enter 动作放一次。
        const scene = readFileSync(
            join(ROOT, 'src', 'game', 'scenes', 'scene.ts'),
            'utf8',
        );
        expect(scene).toContain('arrivalActions(this.level)');
        expect(scene).toContain('this.runInteractable(action)');
    });

    it('keeps the circled spot on record for the editor', () => {
        const bowl = levelUnderTest().interactables?.find((i) => i.action === RICE_BOWL_ACTION);
        const zone = bowl!.zones[0]!;
        expect(2946).toBeGreaterThanOrEqual(zone.x);
        expect(2946).toBeLessThanOrEqual(zone.x + zone.width);
        expect(1517).toBeGreaterThanOrEqual(zone.y);
        expect(1517).toBeLessThanOrEqual(zone.y + zone.height);
    });
});
