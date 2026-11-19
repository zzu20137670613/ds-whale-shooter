/**
 * tests/components/notice-toast.test.ts
 * --------------------------------------------------------------------------
 * The notice is the difference between "the cat gave me a rifle" and "the cat did
 * nothing", so the wiring is worth a test of its own.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { NoticeView } from '@/components/hud/notice-toast';
import { NOTICE_FONT_PX } from '@/lib/constants';
import { useGameStore } from '@/store/game-store';

describe('NoticeToast', () => {
    beforeEach(() => {
        useGameStore.setState({ notice: null, noticeId: 0 });
    });

    it('renders nothing when there is no notice', () => {
        expect(renderToStaticMarkup(React.createElement(NoticeView, { text: null }))).toBe('');
    });

    it('draws the line at the HUD notice size, big enough to read mid-fight', () => {
        // 主人 2026-11-14：`把所有的这种提示字体都给加大3个字号（补血补蓝、冰镇果汁、
        // 天空之城王座的触发词、白米饭饭盆触发词等）`。 15 -> 21.
        // 2026-11-14：15 -> 21；2026-11-17 主人再要加大 3 个字号 -> 27。
        expect(NOTICE_FONT_PX).toBe(27);
        const html = renderToStaticMarkup(
            React.createElement(NoticeView, { text: '灵力碎片自动使用' }),
        );
        expect(html).toContain(`font-size:${NOTICE_FONT_PX}px`);
    });

    it('shows the line it was given', () => {
        const html = renderToStaticMarkup(
            React.createElement(NoticeView, { text: '猫塞给你一把突击步枪' }),
        );
        expect(html).toContain('猫塞给你一把突击步枪');
    });

    it('the store actually carries the line to the view', () => {
        useGameStore.getState().showNotice('猫塞给你一把突击步枪');
        const html = renderToStaticMarkup(
            React.createElement(NoticeView, { text: useGameStore.getState().notice }),
        );
        expect(html).toContain('猫塞给你一把突击步枪');
    });

    it('bumps noticeId so repeating the same line restarts the timer', () => {
        const store = useGameStore.getState();
        store.showNotice('same');
        const first = useGameStore.getState().noticeId;
        store.showNotice('same');
        expect(useGameStore.getState().noticeId).toBe(first + 1);
    });

    it('clears when told to', () => {
        useGameStore.getState().showNotice('x');
        useGameStore.getState().clearNotice();
        expect(useGameStore.getState().notice).toBeNull();
    });
});
