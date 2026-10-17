// @vitest-environment happy-dom
/**
 * tests/components/hud/locale-toggle.test.tsx
 * --------------------------------------------------------------------------
 * The language switch has to move BOTH halves of the bilingual mechanism:
 * the persisted store preference and the i18n runtime that `t()` /
 * `pickText()` read. Testing only the store would miss a runtime that
 * silently stayed on the old language.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocaleToggle } from '@/components/hud/locale-toggle';
import { getLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('LocaleToggle', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    const button = () =>
        container.querySelector('[data-testid="locale-toggle"]') as HTMLButtonElement | null;

    const render = () =>
        act(() => {
            root.render(<LocaleToggle />);
        });

    beforeEach(() => {
        useGameStore.setState({ hubsVisible: true });
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
    });

    it('is hidden with the rest of the HUD', () => {
        useGameStore.setState({ hubsVisible: false });

        render();

        expect(button()).toBeNull();
    });

    it('shows the current language, not the target', () => {
        render();

        expect(button()?.textContent).toContain('EN');
    });

    it('flips the store, the i18n runtime and its own label', () => {
        render();

        act(() => {
            button()?.click();
        });

        expect(useGameStore.getState().locale).toBe('zh-CN');
        expect(getLocale()).toBe('zh-CN');
        expect(button()?.textContent).toContain('中文');
    });

    it('flips back to English', () => {
        useGameStore.getState().setLocale('zh-CN');
        render();

        act(() => {
            button()?.click();
        });

        expect(useGameStore.getState().locale).toBe('en');
        expect(getLocale()).toBe('en');
    });
});