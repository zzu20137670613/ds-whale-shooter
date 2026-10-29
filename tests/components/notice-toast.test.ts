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
import { useGameStore } from '@/store/game-store';

describe('NoticeToast', () => {
    beforeEach(() => {
        useGameStore.setState({ notice: null, noticeId: 0 });
    });

    it('renders nothing when there is no notice', () => {
        expect(renderToStaticMarkup(React.createElement(NoticeView, { text: null }))).toBe('');
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