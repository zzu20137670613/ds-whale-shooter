// @vitest-environment happy-dom
/**
 * tests/components/hud/seed-epilogue.test.tsx
 * --------------------------------------------------------------------------
 * seed, and the shop behind her.
 *
 * Two things the owner will check on the phone: she is only there after the ending, and the
 * four doors plus 取消 all do what they say (three travel, one is a rainbow promise, one
 * leaves).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { SEED_SHOP_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import { t } from '@/locales';
import { SeedShopPanel } from '@/components/hud/seed-shop-panel';
import { useGameStore } from '@/store/game-store';

// Phaser must not load in happy-dom: the real module builds a canvas.
const resolveAndRestart = vi.fn(async (_levelId: string) => {});
vi.mock('@/lib/phaser-game', () => ({ resolveAndRestart: (id: string) => resolveAndRestart(id) }));
vi.mock('@/lib/levels/current-level', () => ({
    subscribeCurrentLevel: () => () => {},
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mount = (element: React.ReactElement) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(element));
    return { container, root };
};

describe('seed is put on the floor by the tavern scene, not by the HUD', () => {
    // She is a Phaser sprite now (`tavern-controller.spawnSeed`), so the wiring is pinned at
    // the source: the HUD cannot mount her any more, and the sprite must ask the same panel.
    const read = (...parts: string[]) =>
        require('node:fs').readFileSync(require('node:path').join(process.cwd(), ...parts), 'utf8');

    it('spawns her from the tavern controller', () => {
        const source = read('src', 'game', 'scenes', 'tavern-controller.ts');
        expect(source).toContain('private spawnSeed()');
        expect(source).toContain('SEED_PAVILION_FEET');
        expect(source).toContain('EventBus.emit(SEED_SHOP_EVENT, undefined)');
    });

    it('keeps her out of the character selection ring', () => {
        const source = read('src', 'game', 'scenes', 'tavern-controller.ts');
        expect(source).toContain('this.spawnSeed();');
        expect(source).toMatch(/this\.npcs = \[\]/);
    });
});

describe('the shop', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        useGameStore.setState({ endingCleared: true, currentLevelId: 'tavern' });
        const mounted = mount(<SeedShopPanel />);
        container = mounted.container;
        root = mounted.root;
        act(() => {
            EventBus.emit(SEED_SHOP_EVENT, undefined);
        });
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
    });

    it('stays closed until seed is tapped', () => {
        expect(container.querySelector('[data-testid="seed-shop"]')).not.toBeNull();
    });

    it('shows four doors and one cancel', () => {
        expect(
            container.querySelector('[data-testid="seed-destination-starry-library"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-testid="seed-destination-sky-city"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="seed-destination-atlantis"]')).not.toBeNull();
        expect(
            container.querySelector('[data-testid="seed-destination-unknown-realm"]'),
        ).not.toBeNull();
        expect(container.querySelector('[data-testid="seed-shop-cancel"]')).not.toBeNull();
    });

    it('shows the title alone, with no tag on the right', () => {
        // The owner had the 创世线 tag removed from the header: the panel is just its title now.
        const panel = container.querySelector('[data-testid="seed-shop"]') as HTMLElement;
        expect(panel.textContent).toContain(t('seedShop.title'));
        expect(panel.textContent).not.toContain('创世线');
        expect(panel.textContent).not.toContain('Genesis line');
    });

    it('paints 未至之境 in rainbow and the rest plainly', () => {
        // The rainbow lives on the label span, not the button: `background-clip: text` clips the
        // gradient to the element's own box, and on the full-width button the short label only
        // sampled the middle of the ramp - it rendered flat cyan on the emulator.
        const rainbow = container.querySelector(
            '[data-testid="seed-destination-label-unknown-realm"]',
        ) as HTMLElement;
        const plain = container.querySelector(
            '[data-testid="seed-destination-label-starry-library"]',
        ) as HTMLElement;
        expect(rainbow.className).toContain('bg-clip-text');
        expect(rainbow.className).toContain('linear-gradient');
        expect(plain.className).not.toContain('bg-clip-text');

        // ...and the button itself must not carry it, or the ramp is stretched over the whole row.
        const button = container.querySelector(
            '[data-testid="seed-destination-unknown-realm"]',
        ) as HTMLElement;
        expect(button.className).not.toContain('bg-clip-text');
    });

    it('travels to the library', () => {
        const button = container.querySelector(
            '[data-testid="seed-destination-starry-library"]',
        ) as HTMLButtonElement;
        act(() => button.click());
        expect(resolveAndRestart).toHaveBeenCalledWith('starry-library-1-entrance');
        // Closing first keeps the panel from riding into the new scene.
        expect(container.querySelector('[data-testid="seed-shop"]')).toBeNull();
    });

    it('travels to the sky city and atlantis too', () => {
        act(() => {
            (
                container.querySelector(
                    '[data-testid="seed-destination-sky-city"]',
                ) as HTMLButtonElement
            ).click();
        });
        expect(resolveAndRestart).toHaveBeenCalledWith('gpt-sky-city-1-entrance');

        act(() => {
            EventBus.emit(SEED_SHOP_EVENT, undefined);
        });
        act(() => {
            (
                container.querySelector(
                    '[data-testid="seed-destination-atlantis"]',
                ) as HTMLButtonElement
            ).click();
        });
        expect(resolveAndRestart).toHaveBeenCalledWith('dsh-atlantis-1-entrance');
    });

    it('says 未至之境 is not open instead of teleporting nowhere', () => {
        const notices: string[] = [];
        useGameStore.setState({ showNotice: (text: string) => notices.push(text) } as never);
        act(() => {
            (
                container.querySelector(
                    '[data-testid="seed-destination-unknown-realm"]',
                ) as HTMLButtonElement
            ).click();
        });
        expect(resolveAndRestart).not.toHaveBeenCalled();
        expect(notices).toHaveLength(1);
        // 主人 2026-11-16：`点击seed的探索未至之境选项时自动关闭seed的时空门弹框`
        // —— 不关的话那句提示被弹框盖住，实际看不见。
        expect(container.querySelector('[data-testid="seed-shop"]')).toBeNull();
    });

    it('leaves through 取消', () => {
        act(() => {
            (
                container.querySelector('[data-testid="seed-shop-cancel"]') as HTMLButtonElement
            ).click();
        });
        expect(container.querySelector('[data-testid="seed-shop"]')).toBeNull();
    });
});
