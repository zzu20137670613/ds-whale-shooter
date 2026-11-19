// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TouchControls } from '@/components/hud/touch-controls';
import { BACKPACK_TOGGLE_EVENT } from '@/lib/constants';
import { EventBus } from '@/lib/events/bus';
import * as mobileModule from '@/lib/mobile';
import { setLocale } from '@/locales';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('TouchControls', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        useGameStore.setState({ tavernCleared: true });
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        EventBus.removeAllListeners();
        vi.restoreAllMocks();
    });

    it('renders null on desktop (not mobile-like)', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);

        act(() => {
            root.render(<TouchControls />);
        });

        expect(container.firstChild).toBeNull();
    });

    it('renders null during tavern character selection (!tavernCleared) to prevent touch interception', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: false });

        act(() => {
            root.render(<TouchControls />);
        });

        expect(container.firstChild).toBeNull();
    });

    it('renders joystick and action buttons when mobile-like and tavernCleared is true', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });

        act(() => {
            root.render(<TouchControls />);
        });

        expect(container.querySelector('[data-testid="touch-joystick-zone"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="touch-joystick"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="touch-dodge"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="touch-shoot"]')).not.toBeNull();
        // The owner's layout: `右侧做3个按钮：【开火】【闪避】【技能】`.
        expect(container.querySelector('[data-testid="touch-skill"]')).not.toBeNull();
        // `背包的话做成一个小背包图标，放右上角`.
        expect(container.querySelector('[data-testid="touch-backpack"]')).not.toBeNull();
    });

    it("labels the three right-hand buttons in the player's language", () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        setLocale('zh-CN');
        useGameStore.setState({ tavernCleared: true, locale: 'zh-CN' });

        act(() => {
            root.render(<TouchControls />);
        });

        const text = container.textContent ?? '';
        expect(text).toContain('开火');
        expect(text).toContain('闪避');
        expect(text).toContain('技能');
        setLocale('en');
    });

    it('emits mobile:move events when joystick zone is touched and dragged', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });

        const moveSpy = vi.fn();
        EventBus.on('mobile:move', moveSpy);

        act(() => {
            root.render(<TouchControls />);
        });

        const zone = container.querySelector(
            '[data-testid="touch-joystick-zone"]',
        ) as HTMLDivElement;
        expect(zone).not.toBeNull();

        // 1. Pointer down on left half (e.g. clientX: 100, clientY: 300)
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerdown', {
                    bubbles: true,
                    clientX: 100,
                    clientY: 300,
                    pointerId: 1,
                }),
            );
        });

        // 2. Drag rightwards (clientX: 140, clientY: 300)
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointermove', {
                    bubbles: true,
                    clientX: 140,
                    clientY: 300,
                    pointerId: 1,
                }),
            );
        });

        expect(moveSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                vx: expect.any(Number),
                vy: expect.any(Number),
            }),
        );
        expect(moveSpy.mock.calls.at(-1)?.[0]?.vx).toBeGreaterThan(0);

        // 3. Pointer up -> resets to null
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerup', {
                    bubbles: true,
                    clientX: 140,
                    clientY: 300,
                    pointerId: 1,
                }),
            );
        });

        expect(moveSpy).toHaveBeenLastCalledWith(null);
    });

    it('emits mobile:skill as a one-shot press', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });

        const skillSpy = vi.fn();
        EventBus.on('mobile:skill', skillSpy);

        act(() => {
            root.render(<TouchControls />);
        });

        const skillBtn = container.querySelector(
            '[data-testid="touch-skill"]',
        ) as HTMLButtonElement;
        act(() => {
            skillBtn.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }),
            );
        });

        expect(skillSpy).toHaveBeenCalledWith(true);
        // No release event: the game clears the flag itself, so holding cannot chain casts.
        expect(skillSpy).toHaveBeenCalledTimes(1);
    });

    it("keeps the three buttons and the chip out of each other's boxes", () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });

        act(() => {
            root.render(<TouchControls />);
        });

        const box = (id: string) => {
            const el = container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
            const style = el.style;
            return {
                right: Number.parseFloat(style.right || '0'),
                bottom: Number.parseFloat(style.bottom || '0'),
                top: style.top ? Number.parseFloat(style.top) : null,
                width: Number.parseFloat(style.width || '0'),
                height: Number.parseFloat(style.height || '0'),
            };
        };

        const fire = box('touch-shoot');
        const dodge = box('touch-dodge');
        const skill = box('touch-skill');
        const bag = box('touch-backpack');

        // `开火在左，闪避+技能在右`: 闪避 is nearest the right edge, 开火 inboard of it.
        expect(fire.bottom).toBe(dodge.bottom);
        expect(dodge.right).toBeLessThan(fire.right);
        expect(fire.right).toBeGreaterThanOrEqual(dodge.right + dodge.width);
        // 技能 stacks above 闪避, in the same column.
        expect(skill.right).toBe(dodge.right);
        expect(skill.bottom).toBeGreaterThanOrEqual(dodge.bottom + dodge.height);
        // 背包长在技能键左边（主人 2026-11-13 挪的）。
        // `right` is the distance from the right edge, so a LARGER value is further left.
        expect(bag.right).toBeGreaterThanOrEqual(skill.right + skill.width);
        // And it sits above the fire button's crown so a thumb never hits both.
        expect(bag.bottom).toBeGreaterThanOrEqual(fire.bottom + fire.height);
    });

    it('asks the backpack to open from the top-right chip', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true, backpackOpen: false });

        // Through the bus now: the overlay owns pausing the scene and the music, and it also has
        // to survive the tap that opened it (it used to close itself in the same frame).
        const opened = vi.fn();
        EventBus.on(BACKPACK_TOGGLE_EVENT, opened);

        act(() => {
            root.render(<TouchControls />);
        });

        const bag = container.querySelector('[data-testid="touch-backpack"]') as HTMLButtonElement;
        act(() => {
            bag.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8 }));
        });

        expect(opened).toHaveBeenCalled();
    });

    it('emits mobile:firing and mobile:dodge on action buttons', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });

        const firingSpy = vi.fn();
        const dodgeSpy = vi.fn();
        EventBus.on('mobile:firing', firingSpy);
        EventBus.on('mobile:dodge', dodgeSpy);

        act(() => {
            root.render(<TouchControls />);
        });

        const shootBtn = container.querySelector(
            '[data-testid="touch-shoot"]',
        ) as HTMLButtonElement;
        const dodgeBtn = container.querySelector(
            '[data-testid="touch-dodge"]',
        ) as HTMLButtonElement;

        // Shoot down & up
        act(() => {
            shootBtn.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }),
            );
        });
        expect(firingSpy).toHaveBeenCalledWith(true);

        act(() => {
            shootBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2 }));
        });
        expect(firingSpy).toHaveBeenCalledWith(false);

        // Dodge down & up
        act(() => {
            dodgeBtn.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, pointerId: 3 }),
            );
        });
        expect(dodgeSpy).toHaveBeenCalledWith(true);

        act(() => {
            dodgeBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3 }));
        });
        expect(dodgeSpy).toHaveBeenCalledWith(false);
    });
});
