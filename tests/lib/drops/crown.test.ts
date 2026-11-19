/**
 * tests/lib/drops/crown.test.ts
 * --------------------------------------------------------------------------
 * 加冕之冠（galgame 联动奖励）的数据与图鉴文案。
 *
 * 主人 2026-11-17：`我现在想要的其实是个王冠型道具，放背包里可以+100血蓝上线的，
 * 当作galgame那边过来的玩家的奖励`，随后定名 `王冠名字叫加冕之冠`。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BAG_DISPLAY_ORDER } from '@/lib/drops/display-order';
import { describeEffect } from '@/lib/drops/effect-text';
import { parseDropYaml } from '@/lib/drops/parser';

const ROOT = process.cwd();
const crown = parseDropYaml(
    readFileSync(join(ROOT, 'public', 'data', 'drops', 'crown.yaml'), 'utf8'),
    'crown',
);

describe('the coronation crown', () => {
    it('is named 加冕之冠', () => {
        expect(crown.nameZh).toBe('加冕之冠');
        expect(crown.name).toBe('Coronation Crown');
    });

    it('adds 100 max HP and 100 max SP while carried', () => {
        expect(crown.effect).toMatchObject({ type: 'max-bonus', hp: 100, sp: 100 });
    });

    it('stays in the bag - it is not consumed on pickup', () => {
        // `kind: static` + 不进 `use-check` 的自动使用：它是被动加成，不是药。
        expect(crown.kind).toBe('static');
        expect(crown.sellPrice).toBe(0);
    });

    it('can only be taken once, no matter how often the map is re-entered', () => {
        // 主人 2026-11-17：`现在重复进入可以无限刷（实际应该只有首次进入才有）`。
        // 一次性是记在**关卡摆位**上的（`onceKey`），不是记在道具上 ——
        // 否则同一道具从别处掉落也会被一起吃掉。
        const level = readFileSync(
            join(ROOT, 'public', 'data', 'levels', 'hidden-whale.yaml'),
            'utf8',
        );
        expect(level).toContain('onceKey: hidden-whale:crown');
    });

    it('is listed in the drop index so it can be fetched', () => {
        const index = readFileSync(join(ROOT, 'public', 'data', 'drops', 'index.yaml'), 'utf8');
        expect(index).toContain('- crown');
    });

    it('has its own 64x64 sprite, like every other drop', () => {
        expect(crown.sprite?.texture).toBe('assets/image/drops/crown.png');
    });

    it('sits between the token shield and the rice bowl', () => {
        // 主人 2026-11-17：`在背包里的位置的话就放在词元盾之后，白米饭之前`。
        const order = [...BAG_DISPLAY_ORDER];
        expect(order.indexOf('crown')).toBe(order.indexOf('token-shield') + 1);
        expect(order.indexOf('crown')).toBe(order.indexOf('rice-bowl-basin') - 1);
    });

    it('uses the same purple as the token shield and the rice bowl', () => {
        // 主人 2026-11-17：`把王冠底色做成与词元盾/白米饭一样的颜色`。
        expect(crown.visual.tint).toBe(0xc084fc);
    });

    it('takes the third of the three light pillars', () => {
        // 主人 2026-11-17：`我们之前做了3个"5毛特效"，词元盾用了一个，白龙獠牙用了一个，
        // 剩下一个用在这里`。金=词元盾、紫=白龙獠牙，剩下的是白（bright）。
        expect(crown.beam).toBe('bright');
    });

    it('announces itself once it is actually in the bag', () => {
        expect(crown.pickupNoticeZh).toContain('加冕之冠');
        expect(crown.pickupNoticeZh).toContain('+100');
        expect(crown.pickupNotice).toBeTruthy();
    });

    it('says what it does, and that it works by being carried', () => {
        const text = describeEffect(crown.effect, crown.descriptionZh, crown.description);
        expect(text.zh).toContain('血上限 +100');
        expect(text.zh).toContain('蓝上限 +100');
        expect(text.zh).toContain('带着就生效');
        expect(text.en).toContain('max HP');
    });
});