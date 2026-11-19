// @vitest-environment happy-dom
/**
 * tests/components/hud/crash-banner-session.test.tsx
 * --------------------------------------------------------------------------
 * 横幅只报告**这一局**的崩溃，不跨会话诈尸。
 *
 * 主人 2026-11-16：修完跳过之后硬刷新，屏幕上还挂着上一轮那条 `queueOp` 的崩溃，
 * 他以为「修了还是报这个」。存储是为了取证，但开机就把旧账翻出来读，只会误导。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { CrashBanner } from '@/components/hud/crash-banner';
import { ackCrashes, crashBootAt, readCrashes } from '@/lib/dev/crash-log';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('the crash banner', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    const banner = () => container.querySelector('[data-testid="crash-banner"]');

    beforeEach(() => {
        localStorage.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        localStorage.clear();
    });

    it('says nothing when the only crash on disk is from a previous session', () => {
        // 上一轮的记录：比本次加载更早。
        localStorage.setItem(
            'ds_whale_shooter_crash',
            JSON.stringify([
                {
                    message: "Cannot read properties of null (reading 'queueOp')",
                    stack: 'at ScenePlugin.resume',
                    context: 'window:error',
                    at: crashBootAt() - 60_000,
                },
            ]),
        );
        ackCrashes(0);
        act(() => root.render(<CrashBanner />));
        expect(banner()).toBeNull();
        // 记录本身还在，取证时读得到。
        expect(readCrashes()).toHaveLength(1);
    });

    it('still reports a crash that happened in this session', () => {
        localStorage.setItem(
            'ds_whale_shooter_crash',
            JSON.stringify([
                {
                    message: 'boom',
                    stack: '',
                    context: 'video:resume-scene',
                    at: crashBootAt() + 1,
                },
            ]),
        );
        ackCrashes(0);
        act(() => root.render(<CrashBanner />));
        expect(banner()).not.toBeNull();
        expect(banner()!.textContent).toContain('boom');
    });
});