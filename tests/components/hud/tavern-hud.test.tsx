// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TavernHud } from '@/components/hud/tavern-hud';
import { EventBus } from '@/lib/events/bus';
import * as mobileModule from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('TavernHud', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        // The store is a module singleton: reset the locale, or a case that
        // switched to Chinese leaks its captions into the next one.
        useGameStore.getState().setLocale('en');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        EventBus.removeAllListeners();
        vi.restoreAllMocks();
    });

    it('renders null when focus is null', () => {
        act(() => {
            root.render(<TavernHud />);
        });
        expect(container.firstChild).toBeNull();
    });

    it('renders character info on desktop during selection phase', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);

        act(() => {
            root.render(<TavernHud />);
        });

        act(() => {
            EventBus.emit('tavern-focus', {
                name: 'Otaku',
                hp: 100,
                sp: 60,
                moveSpeed: 4,
                spRegenMs: 5000,
                description: 'A bookish shut-in',
                phase: 'selection',
                weaponCount: 0,
                weaponMax: 4,
                viewportX: 100,
                viewportY: 200,
            });
        });

        expect(container.textContent).toContain('Otaku');
        expect(container.textContent).toContain('A bookish shut-in');
        expect(container.textContent).toContain('HP');
    });

    it('hides character selection intro card and shows mobile confirm button on mobile', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);

        act(() => {
            root.render(<TavernHud />);
        });

        act(() => {
            EventBus.emit('tavern-focus', {
                name: 'Otaku',
                hp: 100,
                sp: 60,
                moveSpeed: 4,
                spRegenMs: 5000,
                description: 'A bookish shut-in',
                phase: 'selection',
                weaponCount: 0,
                weaponMax: 4,
                viewportX: 100,
                viewportY: 200,
            });
        });

        // Desktop card content (long lore, radar, A/D/F keys) is omitted on mobile
        expect(container.textContent).not.toContain('A bookish shut-in');
        expect(container.textContent).not.toContain('Cycle');
        expect(container.textContent).not.toContain('Hold 1.5s');

        // Mobile compact card contains character name, core stats and tap confirm
        expect(container.textContent).toContain('Otaku');
        expect(container.textContent).toContain('HP');
        expect(container.textContent).toContain('SP');
        expect(container.textContent).toContain('CONFIRM');
        expect(container.textContent).toContain('TAP TO START');
    });

    it('still renders weapon slots on mobile during pickup phase', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);

        act(() => {
            root.render(<TavernHud />);
        });

        act(() => {
            EventBus.emit('tavern-focus', {
                name: 'Otaku',
                hp: 100,
                sp: 60,
                moveSpeed: 4,
                spRegenMs: 5000,
                phase: 'pickup',
                weaponCount: 1,
                weaponMax: 3,
            });
        });

        expect(container.textContent).toContain('Weapon Slots');
        expect(container.textContent).toContain('Stage 1');
    });

    // The lore paragraph is the one italic run of text in this HUD. Italic is
    // synthesised for CJK (Chinese has no italic forms), so it must lean in
    // English only.
    const emitLore = (description: string): void => {
        act(() => {
            EventBus.emit('tavern-focus', {
                name: 'Otaku',
                hp: 100,
                sp: 60,
                moveSpeed: 4,
                spRegenMs: 5000,
                description,
                phase: 'selection',
                weaponCount: 0,
                weaponMax: 4,
                viewportX: 100,
                viewportY: 200,
            });
        });
    };

    const lore = (): Element | null => container.querySelector('[data-testid="tavern-lore"]');

    it('keeps the lore paragraph italic in English', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
        useGameStore.getState().setLocale('en');

        act(() => {
            root.render(<TavernHud />);
        });
        emitLore('A bookish shut-in');

        expect(lore()).not.toBeNull();
        expect(lore()?.className).toContain('italic');
    });

    it('drops the lore italic in Chinese', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
        useGameStore.getState().setLocale('zh-CN');

        act(() => {
            root.render(<TavernHud />);
        });
        emitLore('一个书虫宅男');

        expect(lore()).not.toBeNull();
        expect(lore()?.className).not.toContain('italic');
    });

    it('renders the selection captions in Chinese when the locale is zh-CN', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
        useGameStore.getState().setLocale('zh-CN');

        act(() => {
            root.render(<TavernHud />);
        });
        emitLore('一个书虫宅男');

        expect(container.textContent).toContain('切换');
        expect(container.textContent).toContain('确认（长按 1.5 秒）');
        expect(container.textContent).not.toContain('Cycle');
    });

    it('renders the pickup-phase captions in Chinese, placeholders filled', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
        useGameStore.getState().setLocale('zh-CN');

        act(() => {
            root.render(<TavernHud />);
        });

        act(() => {
            EventBus.emit('tavern-focus', {
                name: '鲸娘',
                hp: 95,
                sp: 75,
                moveSpeed: 2,
                spRegenMs: 4200,
                phase: 'pickup',
                weaponCount: 1,
                weaponMax: 3,
                viewportX: 100,
                viewportY: 200,
            });
        });

        expect(container.textContent).toContain('武器槽');
        expect(container.textContent).toContain('1/3 · 上限 3 把');
        expect(container.textContent).toContain('走到传送门进入第 1 关');
    });
});
