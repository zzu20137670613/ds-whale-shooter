/**
 * tests/lib/levels/hidden-whale-crown.test.ts
 * --------------------------------------------------------------------------
 * 加冕之冠摆在隐藏地图右侧正中间的空地上。
 *
 * 主人的要求（2026-11-17）：`在输入名字那里输入这个神秘小代码 deepseek1314，
 * 出现一个隐藏地图，把这个王冠放隐藏地图右侧正中间的空地上吧`。
 *
 * 为什么值得一条测试：这张图是"占位版"，几何随时可能被重画。位置一旦跑到墙上或者
 * 跑出边界，玩家就永远拿不到这顶冠 —— 而且没有任何报错，只有"怎么没有"。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { load as parseYaml } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const level = parseYaml(
    readFileSync(join(ROOT, 'public', 'data', 'levels', 'hidden-whale.yaml'), 'utf8'),
) as {
    imageSize: string;
    dropSpawns?: { type: string; x: number; y: number }[];
    airWalls?: { id: string; points: number[][] }[];
};

const [w, h] = level.imageSize.split('x').map(Number);
const crown = level.dropSpawns?.find((d) => d.type === 'crown');

describe('the crown on the hidden map', () => {
    it('is placed exactly once', () => {
        expect(crown).toBeDefined();
        expect(level.dropSpawns?.filter((d) => d.type === 'crown')).toHaveLength(1);
    });

    it('sits on the right half, vertically centred', () => {
        expect(crown!.x).toBeGreaterThan(w / 2);
        // 「正中间」：竖直方向离中线的距离不超过地图高度的 2%。
        expect(Math.abs(crown!.y - h / 2)).toBeLessThanOrEqual(h * 0.02);
    });

    it('stays clear of the border walls', () => {
        // 边缘墙各 44px 厚，再留一个光柱的宽度（光柱柱身 173px）。
        const margin = 44 + 90;
        expect(crown!.x).toBeLessThan(w - margin);
        expect(crown!.x).toBeGreaterThan(margin);
        expect(crown!.y).toBeGreaterThan(margin);
        expect(crown!.y).toBeLessThan(h - margin);
    });

    it('is not inside any air wall', () => {
        const inside = (px: number, py: number, pts: number[][]) => {
            const xs = pts.map((p) => p[0]);
            const ys = pts.map((p) => p[1]);
            return (
                px > Math.min(...xs) && px < Math.max(...xs) && py > Math.min(...ys) && py < Math.max(...ys)
            );
        };
        for (const wall of level.airWalls ?? []) {
            expect(inside(crown!.x, crown!.y, wall.points), wall.id).toBe(false);
        }
    });
});