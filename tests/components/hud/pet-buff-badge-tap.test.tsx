// @vitest-environment happy-dom
/**
 * tests/components/hud/pet-buff-badge-tap.test.tsx
 * --------------------------------------------------------------------------
 * The buff's numbers on a phone.
 *
 * Desktop reaches them by hovering the native `title`. The owner: `手机端就是点一下显示，然后点一下
 * 任意位置取消显示`. So a tap opens the panel, and the next tap anywhere - the chip included -
 * closes it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { PetBuffBadge } from '@/components/hud/pet-buff-badge';
import * as mobileModule from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const openBadge = () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<PetBuffBadge />));
    return { container, root };
};

const tap = (element: Element) =>
    act(() => {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11 }));
    });

describe('the buff badge on a phone', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({
            petBonus: { percent: 20, source: 'fallback' } as never,
            selectedCharacterId: 'deepseek',
        });
        const mounted = openBadge();
        container = mounted.container;
        root = mounted.root;
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.restoreAllMocks();
    });

    it('shows nothing extra until it is tapped', () => {
        expect(container.querySelector('[data-testid="pet-buff-badge"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).toBeNull();
    });

    it('opens the same numbers the desktop tooltip carries', () => {
        tap(container.querySelector('[data-testid="pet-buff-badge"]')!);
        const panel = container.querySelector('[data-testid="pet-buff-panel"]');
        expect(panel).not.toBeNull();
        // The catalogue's default locale is English in tests; the numbers are the assertion,
        // not the wording.
        const text = panel!.textContent ?? '';
        expect(text).toContain('+20%');
        expect(text).toContain('Luck');
        expect(text).toContain('Playing as the whale girl');
    });

    it('closes when anywhere else is tapped', () => {
        tap(container.querySelector('[data-testid="pet-buff-badge"]')!);
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).not.toBeNull();

        tap(container.querySelector('[data-testid="pet-buff-scrim"]')!);
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).toBeNull();
    });

    it('closes when the chip itself is tapped again', () => {
        tap(container.querySelector('[data-testid="pet-buff-badge"]')!);
        tap(container.querySelector('[data-testid="pet-buff-badge"]')!);
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).toBeNull();
    });

    it('does not close when the panel itself is tapped', () => {
        tap(container.querySelector('[data-testid="pet-buff-badge"]')!);
        tap(container.querySelector('[data-testid="pet-buff-panel"]')!);
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).not.toBeNull();
    });
});

describe('the buff badge on a desktop', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);
        useGameStore.setState({
            petBonus: { percent: 20, source: 'fallback' } as never,
            selectedCharacterId: 'deepseek',
        });
        const mounted = openBadge();
        container = mounted.container;
        root = mounted.root;
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.restoreAllMocks();
    });

    it('keeps the hover tooltip instead of opening a panel', () => {
        const chip = container.querySelector('[data-testid="pet-buff-badge"]') as HTMLElement;
        expect(chip.getAttribute('title')).toContain('Desktop pet link bonus');

        tap(chip);
        expect(container.querySelector('[data-testid="pet-buff-panel"]')).toBeNull();
    });
});