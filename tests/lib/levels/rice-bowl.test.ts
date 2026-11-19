/**
 * tests/lib/levels/rice-bowl.test.ts
 * --------------------------------------------------------------------------
 * 白米饭 — the steel bowl, now in 初遇之地.
 *
 * The owner's plan puts the bowl in the last boss level: `初遇之地我把铁盆用黄圈给标了，我们
 * 之前准备的彩蛋可以实装了`. Walking into the circle no longer just reads a line - it drops
 * 【deepseek的大白饭饭盆】into the bag, described as 敬请期待 and flagged as the key item for
 * 未至之境. The line that was written for it (`碗底刻着两个字：白米饭`) still plays.
 *
 * Two things can rot here and neither is visible until someone walks the whole block:
 *   - the trigger rectangle drifts off the bowl (it is authored against the painting), and
 *   - the action loses its handler, which reads as "the bowl does nothing" rather than as an
 *     error.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RICE_BOWL_ACTION, RICE_BOWL_DROP_ID } from '@/lib/levels/easter-eggs';
import { parseLevelYaml } from '@/lib/levels/parser';
import en from '@/locales/en';
import zhCN from '@/locales/zh-CN';

const LEVEL_ID = 'warhammer-redeem-4-first-meeting';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);

const bowl = (level.interactables ?? []).find((item) => item.action === RICE_BOWL_ACTION);

describe('the rice bowl is authored into 初遇之地', () => {
    it('exists as an interactable with its own action', () => {
        expect(bowl).toBeDefined();
        expect(bowl!.action).toBe(RICE_BOWL_ACTION);
        expect(bowl!.zones.length).toBeGreaterThan(0);
    });

    it('sits on the owner’s yellow circle, not the old alley coordinates', () => {
        // His new marking is centred on (2946, 1517); the zone is that circle padded out so
        // walking into the paint is enough.
        const zone = bowl!.zones[0];
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;
        expect(Math.abs(cx - 2946)).toBeLessThan(60);
        expect(Math.abs(cy - 1517)).toBeLessThan(60);
    });

    it('is fully inside the painted world', () => {
        for (const zone of bowl!.zones) {
            expect(zone.x).toBeGreaterThanOrEqual(0);
            expect(zone.y).toBeGreaterThanOrEqual(0);
            expect(zone.x + zone.width).toBeLessThanOrEqual(level.imageSize.width);
            expect(zone.y + zone.height).toBeLessThanOrEqual(level.imageSize.height);
        }
    });

    it('hands over the basin itself, named the way he dictated it', () => {
        // 主人最初：`背包里立刻多一个道具【deepseek的大白饭饭盆】介绍为敬请期待（未至之境关键道具）`。
        // 主人 2026-11-15 改口：`把在背包里显示的道具名字直接换成【白米饭】`，
        // 并在点它时说清楚它是未至之境的关键道具。
        const drops = join(process.cwd(), 'public', 'data', 'drops');
        const spec = readFileSync(join(drops, `${RICE_BOWL_DROP_ID}.yaml`), 'utf8');
        expect(spec).toContain('白米饭');
        expect(spec).toContain('敬请期待');
        expect(spec).toContain('未至之境');
        expect(spec).toContain('这个是【未至之境】中的关键道具，现在不能使用');
        // A drop that is not in the index is never loaded, so the bag would show nothing.
        expect(readFileSync(join(drops, 'index.yaml'), 'utf8')).toContain(RICE_BOWL_DROP_ID);
    });

    it('carries the owner’s line in both locales', () => {
        // The word 「白米饭」 is the point of the easter egg; it must survive translation.
        expect(zhCN.easter.riceBowl).toContain('白米饭');
        expect(en.easter.riceBowl.length).toBeGreaterThan(0);
    });

});