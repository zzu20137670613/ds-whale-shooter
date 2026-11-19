/**
 * tests/lib/drops/codex.test.ts
 * --------------------------------------------------------------------------
 * 图鉴列什么、不列什么。
 *
 * 主人 2026-11-15：`背包里面图鉴中的【武器】这一行可以去掉，不需要这行`。
 * 武器不进背包（拾取直接进快捷栏），列在图鉴里只是噪音。
 */

import { describe, expect, it } from 'vitest';

import { buildCodexRows } from '@/lib/drops/codex';

const catalog = {
    'beach-drink': {
        name: 'Deep Sea Drink',
        nameZh: '海底特饮',
        effectZh: '补血 30 + 补蓝 60',
        effectEn: '+30 HP + +60 SP',
        effectKind: 'instant',
    },
    'rice-bowl-basin': {
        name: 'White Rice',
        nameZh: '白米饭',
        effectZh: '敬请期待（未至之境关键道具）',
        effectEn: 'key item',
        effectKind: 'material',
    },
    'hp-shard': {
        name: 'HP Shard',
        nameZh: '生命碎片',
        effectZh: '补血 25',
        effectEn: '+25 HP',
        effectKind: 'instant',
    },
    'gemini-juice-weapon': {
        name: 'Juice Weapon',
        nameZh: '果汁武器',
        effectZh: '换成这把武器',
        effectEn: 'swap to this weapon',
        effectKind: 'weapon',
    },
};

describe('buildCodexRows', () => {
    it('never lists a weapon', () => {
        const ids = buildCodexRows(catalog).map((r) => r.id);
        expect(ids).not.toContain('gemini-juice-weapon');
    });

    it('keeps materials such as the rice bowl', () => {
        const ids = buildCodexRows(catalog).map((r) => r.id);
        expect(ids).toContain('rice-bowl-basin');
    });

    it('orders rows the way the bag does', () => {
        const ids = buildCodexRows(catalog).map((r) => r.id);
        expect(ids).toEqual(['hp-shard', 'beach-drink', 'rice-bowl-basin']);
    });

    it('passes the effect text through untouched', () => {
        const drink = buildCodexRows(catalog).find((r) => r.id === 'beach-drink');
        expect(drink).toMatchObject({
            nameZh: '海底特饮',
            effectZh: '补血 30 + 补蓝 60',
            effectEn: '+30 HP + +60 SP',
        });
    });

    it('keeps an entry whose effect kind is unknown', () => {
        const rows = buildCodexRows({ 'mystery-drop': { name: 'Mystery' } });
        expect(rows).toHaveLength(1);
        expect(rows[0].effectZh).toBe('');
    });
});