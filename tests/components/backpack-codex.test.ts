/**
 * tests/components/backpack-codex.test.ts
 * --------------------------------------------------------------------------
 * 图鉴是主人 2026-11-15 要的那个东西：底部一个【图鉴】按钮，点开/悬停出一页
 * 「道具：效果」，样式照抄词元盾的弹框。
 *
 * 渲染成字符串就够 —— 这里要证的是"每一行长什么样、顺序对不对、没点开时不占屏幕"。
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BackpackCodex } from '@/components/hud/backpack-codex';

const ROWS = [
    { id: 'hp-shard', label: '生命碎片', effect: '补血 25' },
    { id: 'overcharge-core', label: '过载核心', effect: '补血 60 + 补蓝 30' },
    { id: 'beach-drink', label: '海底特饮', effect: '补血 30 + 补蓝 60' },
    { id: 'rice-bowl-basin', label: '白米饭', effect: '敬请期待（未至之境关键道具）' },
];

const render = (props: Partial<React.ComponentProps<typeof BackpackCodex>> = {}) =>
    renderToStaticMarkup(
        React.createElement(BackpackCodex, {
            rows: ROWS,
            emptyText: '还没有认识任何道具',
            titleText: '道具图鉴',
            buttonText: '图鉴',
            ...props,
        }),
    );

describe('BackpackCodex', () => {
    it('shows the button even when the panel is closed', () => {
        const html = render();
        expect(html).toContain('data-testid="backpack-codex-button"');
        expect(html).toContain('图鉴');
        expect(html).not.toContain('data-testid="backpack-codex-panel"');
    });

    it('writes one `道具：效果` row per item, in the order it was given', () => {
        const html = render({ defaultOpen: true });
        expect(html).toContain('data-testid="backpack-codex-panel"');
        expect(html.match(/data-codex-row/g)).toHaveLength(ROWS.length);

        const order = ROWS.map((r) => html.indexOf(r.label));
        expect(order.every((at) => at > 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);

        expect(html).toContain('补血 60 + 补蓝 30');
        expect(html).toContain('补血 30 + 补蓝 60');
        expect(html).toContain('：');
    });

    it('reuses the token-shield panel styling', () => {
        const html = render({ defaultOpen: true });
        expect(html).toContain('border-violet-400/80');
        expect(html).toContain('bg-stone-950/95');
    });

    it('says so when there is nothing to list', () => {
        const html = render({ defaultOpen: true, rows: [] });
        expect(html).toContain('还没有认识任何道具');
        expect(html).not.toContain('data-codex-row');
    });
});