/**
 * tests/lib/levels/once-key.test.ts
 * --------------------------------------------------------------------------
 * 「只给一次」的摆位（`dropSpawns[].onceKey`）。
 *
 * 主人 2026-11-17 的两件事：
 *   · 加冕之冠：`现在重复进入可以无限刷（实际应该只有首次进入才有）`；
 *   · 礁石上的深海特饮：`想要做成跟王冠一样只能拣一次`。
 *
 * 为什么记在**摆位**上而不是道具上：
 * 深海特饮既摆在海滩那张图上，也会从怪身上掉。按道具 id 记的话，打死一只掉深海特饮的怪
 * 就会把那张图上的彩蛋一起吃掉 —— 这是这条设计最容易踩的坑，所以钉在测试里。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const level = (id: string) =>
    parseYaml(readFileSync(join(ROOT, 'public', 'data', 'levels', `${id}.yaml`), 'utf8')) as {
        dropSpawns?: { type: string; x: number; y: number; onceKey?: string }[];
    };

describe('one-shot placements', () => {
    it('the crown in the hidden map has its own key', () => {
        const spawns = level('hidden-whale').dropSpawns ?? [];
        const crown = spawns.find((s) => s.type === 'crown');
        expect(crown?.onceKey).toBe('hidden-whale:crown');
    });

    it('the drink on the rocks has its own key, not the item id', () => {
        const spawns = level('beach-holiday').dropSpawns ?? [];
        const drink = spawns.find((s) => s.type === 'beach-drink');
        expect(drink?.onceKey).toBe('beach-holiday:rock-drink');
        // 关键：不能写成 'beach-drink'（道具 id）—— 那会连怪物掉的那份一起锁掉。
        expect(drink?.onceKey).not.toBe('beach-drink');
    });

    it('every onceKey is unique across levels', () => {
        const keys: string[] = [];
        for (const id of ['hidden-whale', 'beach-holiday']) {
            for (const s of level(id).dropSpawns ?? []) {
                if (s.onceKey) keys.push(s.onceKey);
            }
        }
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('the rock drink is a kept easter egg', () => {
    const drop = readFileSync(join(ROOT, 'public', 'data', 'drops', 'beach-drink.yaml'), 'utf8');

    it('says who it is, so nobody deletes it as a leftover', () => {
        expect(drop).toContain('刻意保留');
        expect(drop).toContain('2026-11-17');
    });

    it('greets the player when it is picked up', () => {
        expect(drop).toContain('pickupNoticeZh');
        expect(drop).toContain('礁石上有杯深海特饮');
    });

    it('no longer claims to be the opening gift or to refill to full', () => {
        // 开场礼物是冰镇果汁（踩沙滩椅），补满也早在 11-15 改成定量了。
        expect(drop).not.toContain('喝完把血和蓝一起补满');
    });
});