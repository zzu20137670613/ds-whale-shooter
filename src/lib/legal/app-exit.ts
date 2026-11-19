/**
 * src/lib/legal/app-exit.ts
 * --------------------------------------------------------------------------
 * Close the app from the renderer, on whichever shell is hosting it.
 *
 * The privacy gate needs this: a player who declines the notice must be able to leave, and the
 * store review finding (164017) is explicit that a refusal may not leave them circling the same
 * dialog. Walking away has to be a real exit, not a shrug.
 *
 * Three runtimes, one function, no new dependencies:
 *
 *   Android (Capacitor)  `window.Capacitor.Plugins.App.exitApp()` — present only when the mobile
 *                        shell installs `@capacitor/app`. The desktop build never has it.
 *   Windows (Electron)   `window.close()`; `electron/main.cjs` quits on `window-all-closed`.
 *   Browser (dev)        nothing to close — report 'none' so the UI can say so.
 *
 * Detection over import: this module is compiled into one bundle that every platform loads, so a
 * static `import { App } from '@capacitor/app'` would break the desktop build.
 */

/** The shape the Capacitor bridge takes on window, trimmed to what we use. */
interface CapacitorLike {
    Plugins?: {
        App?: {
            exitApp?: () => void;
        };
    };
}

/** Where the exit was actually routed. The UI uses this to phrase the fallback. */
export type ExitRoute = 'capacitor' | 'window' | 'none';

export interface ExitDeps {
    /** Injected in tests; read from `window.Capacitor` in the real app. */
    capacitor?: unknown;
    /** Injected in tests; defaults to `window.close`. */
    close?: () => void;
}

/** Read the Capacitor bridge off `window` without assuming it exists. */
function runtimeCapacitor(): unknown {
    const w = globalThis as unknown as { Capacitor?: unknown };
    return w.Capacitor;
}

/** Read `window.close` without assuming a window exists (the tests run in happy-dom). */
function runtimeClose(): (() => void) | undefined {
    const w = globalThis as unknown as { close?: () => void };
    return typeof w.close === 'function' ? () => w.close!() : undefined;
}

/**
 * Leave the app. Returns which path was taken so a caller can explain a dead end.
 *
 * Every branch is wrapped: a missing or broken bridge must never strand the player on a screen
 * whose only button throws.
 */
export function requestExit(deps: ExitDeps = {}): ExitRoute {
    const capacitor = (deps.capacitor ?? runtimeCapacitor()) as CapacitorLike | undefined;
    const exitApp = capacitor?.Plugins?.App?.exitApp;

    if (typeof exitApp === 'function') {
        try {
            exitApp();
            return 'capacitor';
        } catch {
            // Fall through to the window path rather than leaving the player stuck.
        }
    }

    const close = deps.close ?? runtimeClose();
    if (typeof close === 'function') {
        try {
            close();
            return 'window';
        } catch {
            return 'none';
        }
    }

    return 'none';
}
