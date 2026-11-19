// @vitest-environment happy-dom
/**
 * tests/components/hud/settings-overlay.test.tsx
 * --------------------------------------------------------------------------
 * The pause menu must always be closable.
 *
 * The owner's report: `点了读档之后设置界面关不掉了，点×和继续游戏都不行`. Loading a save
 * destroys the scene the menu paused and starts a new one, but the menu still held the
 * destroyed one in `paused.current`. Closing called `scene.resume()` on that corpse, which
 * throws — and because the throw came BEFORE `setOpen(false)`, the panel stayed on screen
 * with every button dead. Both the backdrop click and the × go through the same handler,
 * which is why both were dead.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsOverlay } from '@/components/hud/settings-overlay';
import { reloadPageForSave } from '@/lib/saves/reload';
import { setLocale, t } from '@/locales';
import { useGameStore } from '@/store/game-store';

vi.mock('@/lib/saves/reload', () => ({ reloadPageForSave: vi.fn() }));
vi.mock('@/lib/phaser-game', () => ({
    getPhaserGame: vi.fn(),
    restartAtTavern: vi.fn(),
    resolveAndRestart: vi.fn(),
}));

vi.mock('@/lib/saves/quick', () => ({
    captureThumbnail: () => undefined,
    announceSave: vi.fn(),
}));

import { getPhaserGame } from '@/lib/phaser-game';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<SettingsOverlay />));
}

function click(el: Element | null | undefined) {
    if (!el) throw new Error('element missing');
    act(() => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function sceneThatThrowsOnResume() {
    return {
        scene: {
            pause: vi.fn(),
            resume: vi.fn(() => {
                throw new Error('Cannot read properties of null (reading systems)');
            }),
        },
    };
}

function openMenu() {
    click(document.querySelector(`button[aria-label="${t('settings.title')}"]`));
}

beforeEach(() => {
    setLocale('zh-CN');
    (getPhaserGame as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        scene: { getScenes: () => [sceneThatThrowsOnResume()] },
    });
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllMocks();
});

describe('closing the pause menu', () => {
    it('closes when the paused scene can no longer resume', () => {
        render();
        openMenu();
        expect(document.querySelector('[data-testid="settings-overlay"]')).not.toBeNull();

        // The scene a load destroyed: resume() throws. The menu must still go away.
        click(document.querySelector('button[aria-label="Close"]'));
        expect(document.querySelector('[data-testid="settings-overlay"]')).toBeNull();
    });

    it('closes when the backdrop is clicked, even with a dead scene', () => {
        render();
        openMenu();
        click(document.querySelector('[data-testid="settings-overlay"]'));
        expect(document.querySelector('[data-testid="settings-overlay"]')).toBeNull();
    });
});

describe('loading a save from inside the menu', () => {
    beforeEach(() => {
        // One readable slot. The store's own save code is not what this test is about.
        useGameStore.setState({
            // Slot ids are `1..6` and `quick`, not 'slot-1'.
            listSaveSlots: () =>
                ({
                    1: {
                        id: 1,
                        savedAt: '2026-10-30T12:00:00.000Z',
                        levelId: 'beach-holiday',
                        levelName: '海滩假日',
                        characters: [],
                        money: 0,
                        playtimeMs: 0,
                        slot: 1,
                    },
                }) as never,
            loadFromSlot: () => true,
        });
    });

    it('closes the whole menu instead of leaving it stuck over the new scene', () => {
        render();
        openMenu();
        // Open the save rack.
        const savesButton = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes(t('saves.title')),
        );
        click(savesButton);

        // The quick slot is first in the rack and is empty here, so its 读档 is disabled -
        // pick the enabled one.
        const loadButton = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === t('saves.load') && !b.disabled,
        );
        expect(loadButton, 'a load button should exist for the filled slot').toBeTruthy();
        click(loadButton);

        // Loading a save reloads the page now: an in-place restart kept the old level's
        // textures alive and produced a hybrid scene.
        expect(reloadPageForSave).toHaveBeenCalled();
        // The menu is gone, and the next close attempt cannot touch the dead scene.
        expect(document.querySelector('[data-testid="settings-overlay"]')).toBeNull();
    });
});

describe('the rack layout', () => {
    it('puts the quick slot first, then five manual slots, three per row', () => {
        useGameStore.setState({ listSaveSlots: () => ({}) as never });
        render();
        openMenu();
        const savesButton = Array.from(document.querySelectorAll('button')).find((b) =>
            b.textContent?.includes(t('saves.title')),
        );
        click(savesButton);

        const cards = document.querySelectorAll('[data-save-slot]');
        expect(Array.from(cards).map((c) => c.getAttribute('data-save-slot'))).toEqual([
            'quick',
            '1',
            '2',
            '3',
            '4',
            '5',
        ]);
        // Three per row, so 6 cards make exactly two rows.
        const grid = cards[0].parentElement;
        expect(grid?.className).toContain('grid-cols-3');
        // 45rem x 1.5 again, per the owner's second enlargement.
        expect(document.querySelector('[data-testid="save-slots-panel"] > div')?.className).toContain(
            'w-[67.5rem]',
        );
    });

describe('the corner row', () => {
    it('puts the pet buff to the left of the aim switch', () => {
        useGameStore.setState({
            selectedCharacterId: 'deepseek',
            petBonus: { percent: 50, source: 'pet', label: 'Lv.10', suspended: true },
        });
        render();

        const pet = document.querySelector('[data-testid="pet-buff-badge"]');
        const aim = document.querySelector('[aria-pressed]')?.closest('div');
        expect(pet).not.toBeNull();
        expect(aim).not.toBeNull();
        // The owner asked for it on the left of 键鼠操作, so it must come first in the DOM.
        expect(pet!.compareDocumentPosition(aim!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        useGameStore.setState({ petBonus: null });
    });
});
});
