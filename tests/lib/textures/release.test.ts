import { describe, expect, it } from 'vitest';

import { releasableTextureKeys } from '@/lib/textures/release';

describe('releasableTextureKeys', () => {
    it('hands back the keys the scene loaded', () => {
        expect(releasableTextureKeys(['background:beach-holiday', 'char:seed'])).toEqual([
            'background:beach-holiday',
            'char:seed',
        ]);
    });

    it('never hands back a Phaser built-in', () => {
        expect(releasableTextureKeys(['__DEFAULT', '__MISSING', '__WHITE', 'bg'])).toEqual(['bg']);
    });

    it('dedupes a key loaded twice', () => {
        expect(releasableTextureKeys(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('ignores empty and non-string entries', () => {
        expect(releasableTextureKeys(['', 'a', undefined as unknown as string])).toEqual(['a']);
    });

    it('is order-independent', () => {
        expect(releasableTextureKeys(['b', 'a', 'c'])).toEqual(
            releasableTextureKeys(['c', 'a', 'b']),
        );
    });

    it('takes the Set the scene keeps', () => {
        expect(releasableTextureKeys(new Set(['bg', '__DEFAULT']))).toEqual(['bg']);
    });

    it('is empty when the scene loaded nothing', () => {
        expect(releasableTextureKeys([])).toEqual([]);
    });
});