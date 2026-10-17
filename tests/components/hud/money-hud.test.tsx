// @vitest-environment happy-dom
/**
 * tests/components/hud/money-hud.test.tsx
 * --------------------------------------------------------------------------
 * The wallet chip must mirror the store: hidden with the rest of the HUD,
 * showing the live balance, and re-rendering when a bounty lands mid-combat.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MoneyHud } from '@/components/hud/money-hud';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('MoneyHud', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    const chip = () => container.querySelector('[data-testid="money-hud"]');

    beforeEach(() => {
        useGameStore.setState({ money: 0, hubsVisible: true });
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

    const render = () =>
        act(() => {
            root.render(<MoneyHud />);
        });

    it('renders nothing while the hubs are hidden', () => {
        useGameStore.setState({ hubsVisible: false });

        render();

        expect(chip()).toBeNull();
    });

    it('shows the current balance', () => {
        useGameStore.setState({ money: 250 });

        render();

        expect(chip()?.textContent).toContain('250');
    });

    it('shows a zero balance rather than hiding the wallet', () => {
        render();

        expect(chip()).not.toBeNull();
        expect(chip()?.textContent).toContain('0');
    });

    it('tracks a bounty credited after mount', () => {
        render();

        act(() => {
            useGameStore.getState().addMoney(40);
        });

        expect(chip()?.textContent).toContain('40');
    });
});