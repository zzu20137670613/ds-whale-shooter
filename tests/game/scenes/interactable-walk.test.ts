/**
 * tests/game/scenes/interactable-walk.test.ts
 * --------------------------------------------------------------------------
 * Two ways an authored zone can fire: click, or walking in.
 *
 * The owner, 2026-11-12: `初遇之地走到铁盆那里没显示饭盆彩蛋`。 The rice bowl was authored as a
 * click target, so walking to the steel basin did nothing. `trigger: walk` makes the zone fire on
 * the player's position instead, with no button at all (`走进黄圈就自动获得（不用按键）`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InteractableController } from '@/game/scenes/interactable';
import { parseLevelYaml } from '@/lib/levels/parser';

const BOWL = {
    id: 'rice-bowl',
    action: 'rice-bowl',
    zones: [{ x: 100, y: 100, width: 50, height: 50 }],
    trigger: 'walk' as const,
};
const SCREEN = {
    id: 'dev-screen',
    action: 'dev-mail',
    zones: [{ x: 300, y: 300, width: 40, height: 40 }],
};

describe('InteractableController', () => {
    it('fires a walk zone from the player position', () => {
        const controller = new InteractableController([BOWL, SCREEN]);
        expect(controller.walkInto(120, 120)?.id).toBe('rice-bowl');
        expect(controller.walkInto(0, 0)).toBeNull();
    });

    it('does not fire a walk zone from a click, nor a click zone from walking', () => {
        const controller = new InteractableController([BOWL, SCREEN]);
        expect(controller.handleClick(120, 120)).toBeNull();
        expect(controller.walkInto(310, 310)).toBeNull();
        expect(controller.handleClick(310, 310)?.id).toBe('dev-screen');
    });
});

describe('the first-meeting level', () => {
    it('hands the bowl over on arrival, not on a walk-in zone', () => {
        // 主人 2026-11-15 最终定的：`进入boss战第四关自动出第一句的提示，背包多个白米饭，
        // 重复刷boss关再出第二句提示`。走进去触发在网页上实测不灵，所以改成读图即触发。
        const level = parseLevelYaml(
            readFileSync(
                join(
                    process.cwd(),
                    'public',
                    'data',
                    'levels',
                    'warhammer-redeem-4-first-meeting.yaml',
                ),
                'utf8',
            ),
            'warhammer-redeem-4-first-meeting',
        );
        const bowl = level.interactables?.find((i) => i.action === 'rice-bowl');
        expect(bowl).toBeDefined();
        expect(bowl!.trigger).toBe('enter');
        // zones 只当"饭盆画在哪"的备注；圈仍然盖住主人画的 (2946,1517)。
        const zone = bowl!.zones[0]!;
        expect(2946).toBeGreaterThanOrEqual(zone.x);
        expect(2946).toBeLessThanOrEqual(zone.x + zone.width);
        expect(1517).toBeGreaterThanOrEqual(zone.y);
        expect(1517).toBeLessThanOrEqual(zone.y + zone.height);
    });
});