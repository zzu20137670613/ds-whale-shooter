// @vitest-environment happy-dom
/**
 * tests/components/hud/fullscreen-toggle.test.tsx
 * --------------------------------------------------------------------------
 * The chip exists for desktop and does not exist on a phone.
 *
 * The owner: `移动端也不需要【全屏】按钮，不需要窗口化，移动端打开直接【全屏】，不给窗户化`.
 * There fullscreen is native and unconditional, so a "窗口" button would be a lie.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { FullscreenToggle } from '@/components/hud/fullscreen-toggle';
import * as mobileModule from '@/lib/mobile';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('FullscreenToggle', () => {
    let container: HTMLDivElement;
    let root: any;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.restoreAllMocks();
    });

    it('stays on desktop', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(false);

        act(() => root.render(<FullscreenToggle />));

        expect(container.querySelector('[data-testid="fullscreen-toggle"]')).not.toBeNull();
    });

    it('is not drawn on the mobile build', () => {
        vi.spyOn(mobileModule, 'isMobileLike').mockReturnValue(true);

        act(() => root.render(<FullscreenToggle />));

        expect(container.querySelector('[data-testid="fullscreen-toggle"]')).toBeNull();
        expect(container.firstChild).toBeNull();
    });
});

describe('the shell is fullscreen before the game paints', () => {
    const java = readFileSync(
        join(
            'D:',
            'ds-whale-shooter-mobile',
            'android',
            'app',
            'src',
            'main',
            'java',
            'com',
            'zzu',
            'shenhaihuixiang',
            'MainActivity.java',
        ),
        'utf8',
    );

    it('hides the system bars', () => {
        expect(java).toContain('WindowInsetsCompat.Type.systemBars()');
        expect(java).toContain('controller.hide(');
    });

    it('still lets the player swipe the bars back for a moment', () => {
        // Permanently hiding them would trap the player inside the game.
        expect(java).toContain('BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE');
    });

    it('survives returning from the recent-apps screen', () => {
        expect(java).toContain('onWindowFocusChanged');
    });

    it('keeps the old-device path, where the compat controller does nothing', () => {
        expect(java).toContain('SYSTEM_UI_FLAG_IMMERSIVE_STICKY');
    });

    it('keeps the screen awake while a thumb is on the joystick', () => {
        expect(java).toContain('FLAG_KEEP_SCREEN_ON');
    });
});