/**
 * tests/lib/levels/current-level.test.ts
 * --------------------------------------------------------------------------
 * Whoever needs to know that the map changed has to be able to ask.
 *
 * The shop panel lives in React, above the Phaser scene, so a scene change never unmounted
 * it: open the merchant, walk through a portal, and the panel rode along to the next map -
 * with its 一键回城 button still on screen. The owner found that and asked for the shop to
 * close on a map switch. `setCurrentLevel` is the one call every scene change makes, so the
 * subscription below is where "the map changed" is observable.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    getCurrentLevel,
    resetCurrentLevel,
    setCurrentLevel,
    subscribeCurrentLevel,
} from '@/lib/levels/current-level';

const payload = (id: string) => ({ id, level: { id } as never });

afterEach(() => resetCurrentLevel());

describe('the current-level cache', () => {
    it('remembers the level the scene last loaded', () => {
        setCurrentLevel(payload('beach-holiday'));
        expect(getCurrentLevel()?.id).toBe('beach-holiday');
    });

    it('tells subscribers which level arrived', () => {
        const seen: string[] = [];
        subscribeCurrentLevel((next) => seen.push(next?.id ?? '<null>'));

        setCurrentLevel(payload('dev-cabin'));
        setCurrentLevel(payload('beach-holiday'));

        expect(seen).toEqual(['dev-cabin', 'beach-holiday']);
    });

    it('stays quiet after the subscriber leaves', () => {
        const fn = vi.fn();
        const off = subscribeCurrentLevel(fn);
        setCurrentLevel(payload('beach-holiday'));
        off();
        setCurrentLevel(payload('gpt-sky-city-4-throne-hall'));

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('survives a subscriber that throws, so the scene load is not broken', () => {
        const after = vi.fn();
        subscribeCurrentLevel(() => {
            throw new Error('panel blew up');
        });
        subscribeCurrentLevel(after);

        expect(() => setCurrentLevel(payload('beach-holiday'))).not.toThrow();
        expect(after).toHaveBeenCalledTimes(1);
    });
});