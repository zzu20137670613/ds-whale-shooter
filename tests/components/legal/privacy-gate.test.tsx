// @vitest-environment happy-dom
/**
 * tests/components/legal/privacy-gate.test.tsx
 * --------------------------------------------------------------------------
 * The dialog itself: what a store reviewer sees on a first launch, and what a returning player
 * does not see at all.
 *
 * It has to do four things:
 *   1. block the game until the player agrees,
 *   2. offer a real choice — 同意 AND 不同意 — and never dress a refusal up as 好的 / 我知道了,
 *   3. send a refusal to its own screen instead of re-opening the same dialog (finding 164017),
 *   4. offer the policy link (https, opens outside the app).
 *
 * The wording requirement is not cosmetic: the finding names the exact failure mode
 * (`未提供明确的同意或拒绝按钮，或者使用「好的」「我知道了」等词语`) and the gate is the only thing
 * standing between the bundle and a rejected submission.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { PrivacyGate } from '@/components/legal/privacy-gate';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function click(container: HTMLElement, testId: string) {
    const el = container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
    expect(el, `missing ${testId}`).not.toBeNull();
    act(() => {
        el!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

describe('PrivacyGate', () => {
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

    it('shows the notice with an accept button', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        expect(container.querySelector('[data-testid="privacy-gate"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="privacy-accept"]')).not.toBeNull();
    });

    it('offers a real refusal, not a disguised acknowledgement', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        expect(container.querySelector('[data-testid="privacy-decline"]')).not.toBeNull();

        const buttons = Array.from(container.querySelectorAll('button')).map((b) =>
            (b.textContent ?? '').trim(),
        );
        for (const banned of ['好的', '我知道了', '知道了', 'OK', '确定']) {
            expect(buttons).not.toContain(banned);
        }
    });

    it('tells the player what the game actually does with data', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        const text = container.textContent ?? '';
        // 进度只在本机 - the honest statement for a game with no account and no server-side save.
        expect(text).toContain('本机');
    });

    it('states the purpose, the channel and the scope of the one outbound path', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        const text = container.textContent ?? '';
        expect(text).toContain('目的');
        expect(text).toContain('方式');
        expect(text).toContain('范围');
        expect(text).toContain('留言');
    });

    it('links the policy over https and opens it outside the app', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        const link = container.querySelector(
            '[data-testid="privacy-policy-link"]',
        ) as HTMLAnchorElement | null;
        expect(link).not.toBeNull();
        expect(link!.getAttribute('href')?.startsWith('https://')).toBe(true);
        expect(link!.getAttribute('target')).toBe('_blank');
        expect(link!.getAttribute('rel')).toContain('noreferrer');
    });

    it('reports acceptance exactly once per click', () => {
        const onAccept = vi.fn();
        act(() => root.render(<PrivacyGate onAccept={onAccept} />));

        click(container, 'privacy-accept');

        expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('never records consent on a refusal', () => {
        const onAccept = vi.fn();
        act(() => root.render(<PrivacyGate onAccept={onAccept} />));

        click(container, 'privacy-decline');

        expect(onAccept).not.toHaveBeenCalled();
    });

    it('replaces the dialog with a consequence screen, so a refusal cannot loop', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} />));

        click(container, 'privacy-decline');

        // The notice is gone - it is not re-rendered on top of itself.
        expect(container.querySelector('[data-testid="privacy-gate"]')).toBeNull();
        expect(container.querySelector('[data-testid="privacy-declined"]')).not.toBeNull();
        expect(container.textContent).toContain('不会启动');
    });

    it('lets the player walk away from the consequence screen', () => {
        const onExit = vi.fn(() => 'window');
        act(() => root.render(<PrivacyGate onAccept={() => {}} onExit={onExit} />));

        click(container, 'privacy-decline');
        click(container, 'privacy-exit');

        expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('says so when there is nothing to close', () => {
        act(() => root.render(<PrivacyGate onAccept={() => {}} onExit={() => 'none'} />));

        click(container, 'privacy-decline');
        click(container, 'privacy-exit');

        const note = container.querySelector('[data-testid="privacy-exit-note"]');
        expect(note).not.toBeNull();
        expect(note!.textContent).toContain('手动关闭');
    });

    it('allows a change of mind from the consequence screen', () => {
        const onExit = vi.fn(() => 'window');
        act(() => root.render(<PrivacyGate onAccept={() => {}} onExit={onExit} />));

        click(container, 'privacy-decline');
        click(container, 'privacy-reconsider');

        expect(container.querySelector('[data-testid="privacy-gate"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="privacy-accept"]')).not.toBeNull();
        expect(onExit).not.toHaveBeenCalled();
    });
});
