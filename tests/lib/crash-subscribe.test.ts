/**
 * tests/lib/crash-subscribe.test.ts
 * 崩溃日志的实时订阅：界面要能在崩溃发生的同一刻拿到那句话（主人手机报障只有"又卡了"）。
 */

import { describe, expect, it, vi } from 'vitest';

import { recordCrash, subscribeCrash } from '@/lib/dev/crash-log';

describe('subscribeCrash', () => {
    it('notifies listeners with the recorded message and context', () => {
        const seen: { message: string; context: string }[] = [];
        const off = subscribeCrash((record) => seen.push(record));

        recordCrash(new Error('drop boom'), 'monster:died');

        off();
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({ message: 'drop boom', context: 'monster:died' });
    });

    it('stops notifying after unsubscribe', () => {
        const listener = vi.fn();
        const off = subscribeCrash(listener);
        off();

        recordCrash(new Error('after off'), 'monster:died');

        expect(listener).not.toHaveBeenCalled();
    });

    it('survives a listener that throws', () => {
        const off = subscribeCrash(() => {
            throw new Error('banner exploded');
        });

        expect(() => recordCrash(new Error('original'), 'game:loop')).not.toThrow();
        off();
    });
});