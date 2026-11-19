// @vitest-environment happy-dom
/**
 * tests/components/hud/store-build.test.tsx
 * --------------------------------------------------------------------------
 * What the store build looks like from the player's side.
 *
 * The owner, planning the TapTap upload: `把git图标功能禁掉，把开发者小屋点屏幕留言功能禁掉，这样
 * 我们的枪火柔情就完全没有联网功能纯单机了`. Two surfaces reach the network:
 *
 *   - the repo chip in the top-right chrome (`settings-overlay`),
 *   - the developer cabin's letter form, which posts to the relay (`letter-dialog`).
 *
 * This file pins the second one behaviourally and the first one structurally, because mounting
 * the whole settings hub pulls in Phaser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@/lib/build/store-build', () => ({ STORE_BUILD: true, readStoreBuild: () => true }));

const { LetterDialog } = await import('@/components/hud/letter-dialog');

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('the letter form in a store build', () => {
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

    it('offers no way to type a letter', () => {
        act(() => root.render(<LetterDialog variant="cabin" onClose={() => {}} />));

        expect(container.querySelector('textarea')).toBeNull();
    });

    it('says why, instead of showing an empty window', () => {
        act(() => root.render(<LetterDialog variant="cabin" onClose={() => {}} />));

        const text = container.textContent ?? '';
        expect(text.length).toBeGreaterThan(0);
        expect(text).toMatch(/单机|未开放/);
    });

    it('drops the guestbook link, which is another way off the device', () => {
        act(() => root.render(<LetterDialog variant="cabin" onClose={() => {}} />));

        expect(container.querySelector('a[href^="http"]')).toBeNull();
    });

    it('still closes', () => {
        const onClose = vi.fn();
        act(() => root.render(<LetterDialog variant="cabin" onClose={onClose} />));

        const close = container.querySelector('button[type="button"]') as HTMLButtonElement;
        act(() => {
            close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(onClose).toHaveBeenCalled();
    });
});

describe('the settings chrome in a store build', () => {
    const settings = () =>
        readFileSync(
            join(process.cwd(), 'src', 'components', 'hud', 'settings-overlay.tsx'),
            'utf8',
        );

    it('guards the repo chip with the store flag', () => {
        const source = settings();
        const guard = source.indexOf('!STORE_BUILD');
        const chip = source.indexOf('href={repoUrl()}');
        expect(guard).toBeGreaterThan(-1);
        expect(chip).toBeGreaterThan(guard);
    });

    it('imports the flag rather than deciding at runtime', () => {
        expect(settings()).toContain("from '@/lib/build/store-build'");
    });
});
