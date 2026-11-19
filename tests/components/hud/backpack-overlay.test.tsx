// @vitest-environment happy-dom
/**
 * tests/components/hud/backpack-overlay.test.tsx
 * --------------------------------------------------------------------------
 * The bag has to be readable.
 *
 * The owner's report: `背包里道具的字体看不起，加大一号并且统一用弹药箱这种字体，将数量角标
 * 从格子的右下角挪到格子的右上角`.
 *
 * The names were 9 px in Silkscreen, a pixel font with no CJK glyphs, so every Chinese label
 * fell back per-glyph to whatever the OS picked — and at 9 px that is not a font, it is a
 * smudge. The fix is one explicit stack and one size for every label, plus a count badge at
 * the top-right where it no longer sits on top of the name it is annotating.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackpackOverlay } from '@/components/hud/backpack-overlay';
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

vi.mock('@/lib/phaser-game', () => ({
    getPhaserGame: vi.fn(() => undefined),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
    // The owner reads 弹药箱, not "Ammo Box" - the label follows the locale.
    setLocale('zh-CN');
    useGameStore.setState({
        backpackOpen: true,
        inventory: [
            // 弹药箱 - the label the owner called the clearest one.
            { dropId: 'ammo-box', count: 3 },
        ],
        dropCatalog: {
            'ammo-box': {
                name: 'Ammo Box',
                nameZh: '弹药箱',
                usable: true,
                tint: 0xfbbf24,
                icon: { texture: '', grid: { cols: 1, rows: 1 } },
            },
        } as never,
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGameStore.setState({ backpackOpen: false, inventory: [], dropCatalog: {} });
});

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<BackpackOverlay />));
}

describe('the item label', () => {
    it('is one size bigger than the 9 px it shipped at', () => {
        render();
        const label = document.querySelector('[data-item-label]');
        expect(label).not.toBeNull();
        expect(label!.className).toContain('text-[11px]');
    });

    it('uses one explicit font stack instead of the pixel font falling back per glyph', () => {
        render();
        const label = document.querySelector('[data-item-label]');
        // Silkscreen has no CJK glyphs; naming a CJK stack is what makes 弹药箱 legible.
        expect(label!.className).toContain('Microsoft_YaHei');
        expect(label!.className).not.toContain('Silkscreen');
    });

    it('still shows the name', () => {
        render();
        expect(document.querySelector('[data-item-label]')!.textContent).toBe('弹药箱');
    });
});

describe('the count badge', () => {
    it('sits in the top-right corner, not over the name', () => {
        render();
        const badge = document.querySelector('[data-slot-count]');
        expect(badge).not.toBeNull();
        expect(badge!.className).toContain('right-0');
        expect(badge!.className).toContain('top-0');
        expect(badge!.className).not.toContain('bottom-0');
    });

    it('reads as a count, and is big enough to read', () => {
        render();
        const badge = document.querySelector('[data-slot-count]');
        expect(badge!.textContent).toContain('3');
        expect(badge!.className).toContain('text-[10px]');
    });
});

describe('the grid', () => {
    // The owner: `背包格子再放大一些，宽度不够的话可以再扩一些。让四个字的道具名字显示全`.
    it('gives a cell 56px, enough for four 11px characters', () => {
        render();
        const cell = document.querySelector<HTMLElement>('[data-bag-cell]');
        expect(cell).not.toBeNull();
        expect(cell!.className).toContain('size-14');
    });

    it('gives the columns the same width as the cells', () => {
        render();
        const grid = document.querySelector<HTMLElement>('[data-bag-grid]');
        expect(grid).not.toBeNull();
        expect(grid!.style.gridTemplateColumns).toContain('3.5rem');
    });

    it('shows a four-character name in full - no clipped glyph', () => {
        useGameStore.setState({
            inventory: [{ dropId: 'hp-shard', count: 1 }],
            dropCatalog: {
                'hp-shard': {
                    name: 'HP Shard',
                    nameZh: '生命碎片',
                    usable: true,
                    tint: 0xf87171,
                    icon: undefined,
                },
            } as never,
        });
        render();
        const label = document.querySelector('[data-item-label]');
        expect(label!.textContent).toBe('生命碎片');
        // It may still be a single line (no wrapping), but it may not be cut short.
        expect(label!.className).toContain('whitespace-nowrap');
    });
});