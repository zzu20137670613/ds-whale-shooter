// @vitest-environment happy-dom
/**
 * tests/components/hud/monster-counter.test.tsx
 * --------------------------------------------------------------------------
 * 剩余怪物数：X, under the combo counter.
 *
 * The owner: `在右上角连击数的下方位置添加一行：剩余怪物数：X  X跟随地图上剩余怪物数实时变化`.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MonsterCounter } from '@/components/hud/monster-counter';
import { EventBus } from '@/lib/events/bus';
import { MONSTERS_REMAINING_EVENT } from '@/lib/monsters/remaining';
import { setLocale } from '@/locales';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<MonsterCounter />));
}

const emit = (count: number) =>
    act(() => {
        EventBus.emit(MONSTERS_REMAINING_EVENT, { count });
    });

beforeEach(() => {
    setLocale('zh-CN');
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('the remaining-monster line', () => {
    it('says nothing before the first count arrives', () => {
        render();
        expect(document.querySelector('[data-monster-counter]')).toBeNull();
    });

    it('prints the count in Chinese', () => {
        render();
        emit(7);
        const line = document.querySelector('[data-monster-counter]');
        expect(line).not.toBeNull();
        expect(line!.textContent).toContain('剩余怪物数');
        expect(line!.textContent).toContain('7');
    });

    it('follows the count live', () => {
        render();
        emit(7);
        emit(3);
        expect(document.querySelector('[data-monster-counter]')!.textContent).toContain('3');
        emit(0);
        expect(document.querySelector('[data-monster-counter]')!.textContent).toContain('0');
    });

    it('stays on screen at zero, so "cleared" is readable', () => {
        render();
        emit(0);
        expect(document.querySelector('[data-monster-counter]')).not.toBeNull();
    });

    it('sits on the right edge, below the combo counter', () => {
        render();
        emit(4);
        const line = document.querySelector<HTMLElement>('[data-monster-counter]')!;
        // The combo block is `top-26 right-6` (104px) and is ~60px tall once the number and its
        // timer bar are stacked, so this has to start below ~164px - 10.5rem is 168px.
        expect(line.className).toContain('right-6');
        expect(line.className).toContain('top-[10.5rem]');
    });

    it('is readable: one size, not tiny grey', () => {
        render();
        emit(4);
        const line = document.querySelector<HTMLElement>('[data-monster-counter]')!;
        expect(line.className).toContain('text-[13px]');
    });

    it('stops listening when unmounted', () => {
        render();
        emit(5);
        act(() => root.unmount());
        host.remove();
        // A later emit must not throw against a dead tree.
        expect(() => emit(1)).not.toThrow();
    });

    it('draws no chip behind the line', () => {
        // The owner read the 80%-black chip as a black bar under the text: `这行字不是直接底版全
        // 透明的吗`. It is bare text now, with only a shadow for legibility.
        render();
        emit(3);
        const line = document.querySelector('[data-monster-counter]') as HTMLElement;
        expect(line.className).not.toContain('bg-black');
        expect(line.className).not.toContain('border');
        expect(line.className).toContain('drop-shadow');
    });
});
