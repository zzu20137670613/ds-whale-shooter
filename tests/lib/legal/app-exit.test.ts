/**
 * tests/lib/legal/app-exit.test.ts
 * --------------------------------------------------------------------------
 * Declining the privacy notice has to actually close the app.
 *
 * The store review finding (164017) says a refusal must not trap the player in a dialog loop, so
 * the gate sends them to a "you said no" screen whose exit button has to work on all three places
 * this game runs: Android (Capacitor), Windows (Electron), and a plain browser tab during dev.
 *
 * The three runtimes are detected, not imported, because this file ships in the same bundle to
 * every platform: `@capacitor/app` does not exist in the desktop build, and Electron has no
 * Capacitor bridge at all.
 */

import { describe, expect, it, vi } from 'vitest';

import { requestExit } from '@/lib/legal/app-exit';

describe('requestExit', () => {
    it('uses the Capacitor App plugin when the Android shell provides it', () => {
        const exitApp = vi.fn();
        const close = vi.fn();

        const route = requestExit({
            capacitor: { Plugins: { App: { exitApp } } },
            close,
        });

        expect(route).toBe('capacitor');
        expect(exitApp).toHaveBeenCalledTimes(1);
        expect(close).not.toHaveBeenCalled();
    });

    it('falls back to closing the window on the desktop build', () => {
        const close = vi.fn();

        const route = requestExit({ close });

        expect(route).toBe('window');
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('reports "none" when there is nothing to close, instead of throwing', () => {
        const route = requestExit({ close: undefined, capacitor: undefined });

        expect(route).toBe('none');
    });

    it('ignores a Capacitor object without the App plugin', () => {
        const close = vi.fn();

        const route = requestExit({ capacitor: { Plugins: {} }, close });

        expect(route).toBe('window');
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the platform bridge itself throws', () => {
        const route = requestExit({
            capacitor: {
                Plugins: {
                    App: {
                        exitApp: () => {
                            throw new Error('bridge is gone');
                        },
                    },
                },
            },
            close: () => {
                throw new Error('window is gone');
            },
        });

        expect(route).toBe('none');
    });
});
