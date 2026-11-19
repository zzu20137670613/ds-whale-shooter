// @vitest-environment happy-dom
/**
 * tests/lib/inventory/backpack-opening-click.test.ts
 * --------------------------------------------------------------------------
 * The bag must survive the tap that opened it.
 *
 * The owner: `背包按钮点不开，点了闪一下就没了`. The chip lives under the backdrop, so the same
 * tap produced a backdrop `click` right after the overlay mounted, and the overlay treated it as
 * a dismissal.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { TouchControls } from '@/components/hud/touch-controls';
import { BACKPACK_TOGGLE_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import {
    BACKDROP_CLICK_GRACE_MS,
    ignoresBackdropClick,
} from '@/lib/inventory/backdrop-click';
import * as mobileModule from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the grace window', () => {
    it('is long enough for a slow tap and short enough to stay out of the way', () => {
        expect(BACKDROP_CLICK_GRACE_MS).toBeGreaterThanOrEqual(250);
        expect(BACKDROP_CLICK_GRACE_MS).toBeLessThanOrEqual(500);
    });

    it('ignores a click inside the window', () => {
        expect(ignoresBackdropClick(1000, 1100)).toBe(true);
    });

    it('accepts a click after it', () => {
        expect(ignoresBackdropClick(1000, 1000 + BACKDROP_CLICK_GRACE_MS)).toBe(false);
        expect(ignoresBackdropClick(1000, 5000)).toBe(false);
    });

    it('treats an unset clock as "closed", so a late click still closes', () => {
        expect(ignoresBackdropClick(0, 10)).toBe(false);
    });
});

describe('the chip', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true, backpackOpen: false });
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        EventBus.removeAllListeners();
        vi.restoreAllMocks();
    });

    it('asks the overlay to toggle instead of setting the store itself', () => {
        // Two owners of "open the bag" drift: the overlay also pauses the scene and the music.
        const spy = vi.fn();
        EventBus.on(BACKPACK_TOGGLE_EVENT, spy);

        act(() => root.render(<TouchControls />));
        const bag = container.querySelector('[data-testid="touch-backpack"]') as HTMLButtonElement;
        act(() => {
            bag.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }));
        });

        expect(spy).toHaveBeenCalled();
        expect(useGameStore.getState().backpackOpen).toBe(false);
    });
});

describe('the overlay', () => {
    it('guards the backdrop click', () => {
        const source = read('src', 'components', 'hud', 'backpack-overlay.tsx');
        expect(source).toContain('ignoresBackdropClick(openedAt.current, performance.now())');
    });

    it('renames the wait into a constant instead of an inline number', () => {
        expect(read('src', 'lib', 'inventory', 'backdrop-click.ts')).toContain(
            'BACKDROP_CLICK_GRACE_MS',
        );
    });
});