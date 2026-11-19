/**
 * tests/lib/dev/crash-log.test.ts
 * --------------------------------------------------------------------------
 * A frozen run with no message is the worst failure mode this game has: the player sees a still
 * frame, and the only diagnostic is a screenshot. The owner hit exactly that after 半神·Claude
 * fell (`打完半神·Claude还卡死了`) - the Phaser loop was dead, the save clock was not advancing,
 * and nothing anywhere said why.
 *
 * So: keep the last few errors on the device, and let one bad frame be survivable.
 */

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import { clearCrashes, formatCrash, readCrashes, recordCrash } from '@/lib/dev/crash-log';

describe('the crash log', () => {
    beforeEach(() => {
        clearCrashes();
    });

    it('starts empty', () => {
        expect(readCrashes()).toEqual([]);
    });

    it('keeps the message, the stack and where it happened', () => {
        recordCrash(new Error('boom'), 'scene:update');
        const [crash] = readCrashes();
        expect(crash.message).toBe('boom');
        expect(crash.context).toBe('scene:update');
        expect(crash.stack).toContain('boom');
        expect(crash.at).toBeGreaterThan(0);
    });

    it('takes a thrown value that is not an Error', () => {
        recordCrash('a string', 'listener');
        expect(readCrashes()[0].message).toBe('a string');
    });

    it('keeps the newest first and stops at five', () => {
        for (let i = 0; i < 7; i += 1) recordCrash(new Error(`e${i}`), 'scene:update');
        const crashes = readCrashes();
        expect(crashes).toHaveLength(5);
        expect(crashes[0].message).toBe('e6');
    });

    it('survives a storage that refuses to write', () => {
        // A locked-down WebView must not turn the error reporter into a second error.
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = () => {
            throw new Error('quota');
        };
        try {
            expect(() => recordCrash(new Error('still fine'))).not.toThrow();
        } finally {
            Storage.prototype.setItem = original;
        }
    });

    it('formats one line per crash for a bug report', () => {
        recordCrash(new Error('boom'), 'scene:update');
        const text = formatCrash(readCrashes()[0]);
        expect(text).toContain('scene:update');
        expect(text).toContain('boom');
    });
});
