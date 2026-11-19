/**
 * tests/lib/levels/rice-bowl-grant.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-14：`踩到那个饭盆上没触发白米饭饭盆彩蛋提示词，但是背包里有了这个`。
 *
 * 两处真的坏了，都不是"没触发"：
 *
 *  1. **背包里那格没有名字** —— 截图里它显示成 `rice-bowl-basin` 一坨 id。原因：这个道具
 *     只由互动体发给玩家，关卡数据里没有任何 `dropSpawns` / 怪物掉落引用它，所以
 *     `collectDropIds` 从来不预取它的 spec，背包查不到名字和图标，只好把 id 印出来。
 *     （猫猫商店那把步枪早就踩过同一个坑，见 `CAT_SHOP_GIFT_DROP_ID` 那段注释。）
 *  2. **再走一遍什么都不说** —— walk 互动是"一次进关只放一次"，第一次那句台词只有 15px、
 *     站在饭盆前根本没注意；第二次走过去就彻底沉默了，读起来就是"提示词没触发"。
 *     改成"踏进来那一刻触发"，走出去再进来可以再读一遍，道具不会重复进包。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { RICE_BOWL_ACTION, RICE_BOWL_DROP_ID } from '@/lib/levels/easter-eggs';
import { parseLevelYaml } from '@/lib/levels/parser';
import { collectDropIds } from '@/lib/levels/prefetch';

const ROOT = process.cwd();

function level() {
    return parseLevelYaml(
        readFileSync(
            join(ROOT, 'public', 'data', 'levels', 'warhammer-redeem-4-first-meeting.yaml'),
            'utf8',
        ),
        'warhammer-redeem-4-first-meeting',
    );
}

describe('the rice bowl gift', () => {
    it('loads its spec, so the bag can show a name instead of the raw id', () => {
        const ids = collectDropIds(level(), new Map());
        expect(ids.has(RICE_BOWL_DROP_ID)).toBe(true);
    });

    it('is the same id the interactable grants', () => {
        expect(RICE_BOWL_DROP_ID).toBe('rice-bowl-basin');
        expect(RICE_BOWL_ACTION).toBe('rice-bowl');
    });

    it('ships its own 64x64 icon, so the bag shows art instead of a grey chip', () => {
        // 主人 2026-11-14：`用这个吧，你给适配一下我们风格把底色改改`。
        const yaml = readFileSync(
            join(ROOT, 'public', 'data', 'drops', `${RICE_BOWL_DROP_ID}.yaml`),
            'utf8',
        );
        expect(yaml).toContain('assets/image/drops/rice-bowl-basin.png');

        // `loadDropAssets` slices every drop texture as 64x64; anything else is a sliver.
        const buf = readFileSync(
            join(ROOT, 'public', 'assets', 'image', 'drops', 'rice-bowl-basin.png'),
        );
        expect(buf.readUInt32BE(16)).toBe(64);
        expect(buf.readUInt32BE(20)).toBe(64);
    });

    it('ships a spec with a real name in both languages', () => {
        // 有 spec 才有名字；名字缺失时背包会把 id 印出来。
        const yaml = readFileSync(
            join(ROOT, 'public', 'data', 'drops', `${RICE_BOWL_DROP_ID}.yaml`),
            'utf8',
        );
        expect(yaml).toContain('name:');
        expect(yaml).toContain('nameZh:');
        // 主人 2026-11-15：`把在背包里显示的道具名字直接换成【白米饭】`
        expect(yaml).toContain('白米饭');
    });
});
