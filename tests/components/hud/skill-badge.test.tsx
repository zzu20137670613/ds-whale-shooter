// @vitest-environment happy-dom
/**
 * tests/components/hud/skill-badge.test.tsx
 * --------------------------------------------------------------------------
 * The E badge's contract: it stays hidden until the scene announces a skill,
 * it follows the tone the pure helper picks, and it flashes when the skill
 * actually fires.
 *
 * The scene is the only publisher — `skill:status` at ~10Hz and `skill:used`
 * on a successful cast — so the tests drive the bus, not the store.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SkillBadge } from '@/components/hud/skill-badge';
import { EventBus } from '@/lib/events/bus';

// Without this, React's `act()` refuses to flush and the DOM never catches
// up — every HUD component test in this repo sets it.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('SkillBadge', () => {
    let container: HTMLDivElement;
    let root: Root;

    const q = () => container.querySelector('[data-testid="skill-badge"]');

    const status = (patch: Record<string, unknown>) =>
        act(() => {
            EventBus.emit('skill:status', {
                readyInMs: 0,
                sp: 100,
                spCost: 40,
                wornHits: 0,
                ...patch,
            });
        });

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => {
            root.render(<SkillBadge />);
        });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        EventBus.removeAllListeners('skill:status');
        EventBus.removeAllListeners('skill:used');
    });

    it('stays hidden while no skill has been announced', () => {
        expect(q()).toBeNull();
    });

    it('turns ready when off cooldown and affordable', () => {
        status({});
        expect(q()?.getAttribute('data-tone')).toBe('ready');
    });

    it('turns grey while cooling down', () => {
        status({ readyInMs: 4000 });
        expect(q()?.getAttribute('data-tone')).toBe('cooling');
    });

    it('turns red when the pool cannot pay', () => {
        status({ sp: 10, spCost: 40 });
        expect(q()?.getAttribute('data-tone')).toBe('no-sp');
    });

    it('flashes when the skill fires', () => {
        status({});
        expect(q()?.className).not.toContain('scale-125');

        act(() => {
            EventBus.emit('skill:used', {});
        });

        expect(q()?.className).toContain('scale-125');
    });
});
