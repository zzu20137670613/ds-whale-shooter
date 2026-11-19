/**
 * tests/lib/drops/pickup-notice-levels.test.ts
 * --------------------------------------------------------------------------
 * 拾取台词的**两层绑定**：道具自己有台词，且（如果它声明了白名单）当前关卡在名单里。
 *
 * 主人 2026-11-17：`介意，做两层绑定吧，现在这样是一层绑定，另一层就查地图名是不是海滩假日，
 * 同时满足才弹台词就好了嘛`。
 *
 * 为什么需要：深海特饮既摆在礁石上当彩蛋，也会从奔波儿灞、看守者身上掉出来。
 * 只绑道具的话，打死一只怪也会弹「礁石上有杯深海特饮」——在别的地图上说礁石上是错的。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pickupNoticeApplies } from '@/lib/drops/effect-text';
import { parseDropYaml } from '@/lib/drops/parser';

const ROOT = process.cwd();
const parse = (id: string) =>
    parseDropYaml(readFileSync(join(ROOT, 'public', 'data', 'drops', `${id}.yaml`), 'utf8'), id);

const rockDrink = {
    pickupNotice: 'A glass of Deep Sea Drink on the rocks... who left it here?',
    pickupNoticeZh: '礁石上有杯深海特饮……是谁放在这儿的？',
    pickupNoticeLevels: ['beach-holiday'],
};

describe('pickupNoticeApplies', () => {
    it('fires on the level it names', () => {
        expect(pickupNoticeApplies(rockDrink, 'beach-holiday')).toBe(true);
    });

    it('stays quiet on any other level', () => {
        // 同一件道具从怪身上掉出来时，别再提礁石。
        expect(pickupNoticeApplies(rockDrink, 'tavern')).toBe(false);
        expect(pickupNoticeApplies(rockDrink, 'dsh-atlantis-1-entrance')).toBe(false);
        expect(pickupNoticeApplies(rockDrink, undefined)).toBe(false);
    });

    it('fires everywhere when no level list is given', () => {
        // 加冕之冠走这条：它只有一处来源，不需要限定。
        const crown = { pickupNotice: 'x', pickupNoticeZh: 'y' };
        expect(pickupNoticeApplies(crown, 'hidden-whale')).toBe(true);
        expect(pickupNoticeApplies(crown, undefined)).toBe(true);
    });

    it('never fires without a line at all', () => {
        expect(pickupNoticeApplies({}, 'beach-holiday')).toBe(false);
        expect(pickupNoticeApplies({ pickupNoticeLevels: ['beach-holiday'] }, 'beach-holiday')).toBe(
            false,
        );
    });
});

describe('the shipped data', () => {
    it('limits the rock drink to 海滩假日', () => {
        const spec = parse('beach-drink');
        expect(spec.pickupNoticeLevels).toEqual(['beach-holiday']);
        expect(spec.pickupNoticeZh).toContain('礁石上有杯深海特饮');
    });

    it('leaves the crown unlimited', () => {
        expect(parse('crown').pickupNoticeLevels).toBeUndefined();
    });
});