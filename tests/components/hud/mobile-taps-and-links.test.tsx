// @vitest-environment happy-dom
/**
 * tests/components/hud/mobile-taps-and-links.test.tsx
 * --------------------------------------------------------------------------
 * Two things the owner hit on the phone:
 *
 *   1. `在行走摇杆不动的情况下，点击屏幕应该触发点击事件的，现在进入开发者小屋的时候点不到猫猫了`
 *      - the joystick's catch zone swallowed taps; a still, short press now goes to the canvas.
 *   2. `手机端的git按钮应该连mobile这个仓库，而不是PC的仓库`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { TouchControls } from '@/components/hud/touch-controls';
import * as mobileModule from '@/lib/mobile';
import { useGameStore } from '@/store/game-store';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('a tap on the joystick zone', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);
        useGameStore.setState({ tavernCleared: true });
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.restoreAllMocks();
    });

    it('reaches the canvas when the finger did not move', () => {
        act(() => root.render(<TouchControls />));
        const zone = container.querySelector('[data-testid="touch-joystick-zone"]') as HTMLDivElement;
        const canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        const taps: string[] = [];
        for (const type of ['pointerdown', 'pointerup', 'click']) {
            canvas.addEventListener(type, () => taps.push(type));
        }

        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 600, pointerId: 5 }),
            );
        });
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerup', { bubbles: true, clientX: 302, clientY: 601, pointerId: 5 }),
            );
        });

        expect(taps).toContain('pointerdown');
        expect(taps).toContain('click');
        canvas.remove();
    });

    it('does not forward a drag', () => {
        act(() => root.render(<TouchControls />));
        const zone = container.querySelector('[data-testid="touch-joystick-zone"]') as HTMLDivElement;
        const canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        const taps: string[] = [];
        canvas.addEventListener('pointerdown', () => taps.push('pointerdown'));

        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 600, pointerId: 6 }),
            );
        });
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointermove', { bubbles: true, clientX: 380, clientY: 600, pointerId: 6 }),
            );
        });
        act(() => {
            zone.dispatchEvent(
                new PointerEvent('pointerup', { bubbles: true, clientX: 380, clientY: 600, pointerId: 6 }),
            );
        });

        expect(taps).toEqual([]);
        canvas.remove();
    });
});

describe('the repo chip', () => {
    // Rendered in a browser only: importing the overlay drags Phaser in, and happy-dom has no
    // canvas context. The decision itself is one line, pinned here.
    it('decides the repo from the build flag, not from the pointer', () => {
        // 2026-11-19 起两个平台都指向作者主页（`GITEE_OWNER_URL`），
        // 但"按构建来挑链接"这个结构仍要留着 —— 商店包里它会被裁成空字符串。
        const source = read('src', 'components', 'hud', 'settings-overlay.tsx');
        expect(source).toContain('isMobileBuild() ? REPO_URL_MOBILE : REPO_URL_PC');
        expect(source).toContain('GITEE_OWNER_URL');
        expect(source).toContain('href={repoUrl()}');
    });

    it('keeps the tap thresholds named instead of magic numbers', () => {
        const source = read('src', 'components', 'hud', 'touch-controls.tsx');
        expect(source).toContain('TAP_MAX_TRAVEL_PX');
        expect(source).toContain('TAP_MAX_MS');
    });
});