// @vitest-environment happy-dom
/**
 * tests/components/hud/death-overlay-text.test.tsx
 * --------------------------------------------------------------------------
 * The death screen's two lines are readable.
 *
 * The owner: `将死亡界面的【真可惜，我不是主角】和【回到海边亭台】两句话都改成白色字体，并增大2个字号`.
 * The subtitle was stone-500 at 10px - a caption nobody read - and the button wore black text
 * on amber, which at 12px read as a label rather than the way out.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeathOverlay } from '@/components/hud/death-overlay';

// The overlay imports the Phaser entry point for its restart helper; happy-dom cannot load it.
vi.mock('@/lib/phaser-game', () => ({ restartAtTavern: vi.fn() }));
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<DeathOverlay />));
}

beforeEach(() => {
    setLocale('zh-CN');
    useGameStore.setState({ isDead: true, locale: 'zh-CN' } as never);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useGameStore.setState({ isDead: false } as never);
});

const subtitle = () =>
    Array.from(document.querySelectorAll('[data-testid="death-overlay"] div')).find((el) =>
        el.className.includes('text-center'),
    )!;

const restart = () =>
    document.querySelector<HTMLButtonElement>('[data-testid="death-overlay"] button')!;

describe('the two lines', () => {
    it('the subtitle is white and two sizes up', () => {
        render();
        const line = subtitle();
        expect(line.textContent).toContain('我不是主角');
        expect(line.className).toContain('text-white');
        expect(line.className).toContain('text-[14px]');
        expect(line.className).not.toContain('text-stone-500');
    });

    it('the restart button is white and two sizes up', () => {
        render();
        const button = restart();
        // The button reads 重新出发; 回到海边亭台 is the subtitle's promise, not its label.
        expect(button.textContent).toBeTruthy();
        expect(button.className).toContain('text-white');
        expect(button.className).toContain('text-[16px]');
        expect(button.className).not.toContain('text-black');
        expect(button.className).not.toContain('text-xs');
    });

    it('the button is a little taller, so 16px does not crowd its edges', () => {
        render();
        expect(restart().className).toContain('h-10');
    });
});