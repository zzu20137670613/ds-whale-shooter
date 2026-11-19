// @vitest-environment happy-dom
/**
 * tests/lib/dev/preview-spawn.test.ts
 * --------------------------------------------------------------------------
 * `?at=x,y` is the only way to stand on the throne or at the four-block junction without a
 * playthrough, so the parsing has to be strict and the hook has to be one-shot: a value that
 * silently never fires, or fires twice, would turn a real bug into a fake green.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    parsePreviewSpawn,
    resetPreviewSpawnForTests,
    takePreviewSpawn,
} from '@/lib/dev/preview-spawn';

function withSearch(search: string) {
    window.history.replaceState({}, '', `/${search}`);
    resetPreviewSpawnForTests();
}

describe('parsePreviewSpawn', () => {
    it('reads a plain pair', () => {
        expect(parsePreviewSpawn('8300,4600')).toEqual({ x: 8300, y: 4600 });
    });

    it('tolerates spaces', () => {
        expect(parsePreviewSpawn(' 8300 , 4600 ')).toEqual({ x: 8300, y: 4600 });
    });

    it('accepts decimals', () => {
        expect(parsePreviewSpawn('748.5,5459.25')).toEqual({ x: 748.5, y: 5459.25 });
    });

    it('rejects anything that is not a pair of numbers', () => {
        expect(parsePreviewSpawn('')).toBeNull();
        expect(parsePreviewSpawn(null)).toBeNull();
        expect(parsePreviewSpawn(undefined)).toBeNull();
        expect(parsePreviewSpawn('8300')).toBeNull();
        expect(parsePreviewSpawn('8300,')).toBeNull();
        expect(parsePreviewSpawn('a,b')).toBeNull();
        expect(parsePreviewSpawn('8300;4600')).toBeNull();
    });
});

describe('takePreviewSpawn', () => {
    beforeEach(() => {
        withSearch('');
    });

    afterEach(() => {
        window.history.replaceState({}, '', '/');
        resetPreviewSpawnForTests();
    });

    it('hands the position over once, then stops', () => {
        withSearch('?at=8500,4700');
        expect(takePreviewSpawn('gpt-sky-city-4-throne-hall')).toEqual({ x: 8500, y: 4700 });
        expect(takePreviewSpawn('gpt-sky-city-4-throne-hall')).toBeNull();
    });

    it('refuses the tavern, where arbitrary coordinates would be under the floor', () => {
        withSearch('?at=8500,4700');
        expect(takePreviewSpawn('tavern')).toBeNull();
        // …and the refusal does not spend it: the next real level still gets the position.
        expect(takePreviewSpawn('gpt-sky-city-4-throne-hall')).toEqual({ x: 8500, y: 4700 });
    });

    it('is null when the parameter is absent', () => {
        expect(takePreviewSpawn('gpt-sky-city-4-throne-hall')).toBeNull();
    });

    it('is null when the parameter is rubbish', () => {
        withSearch('?at=nope');
        expect(takePreviewSpawn('gpt-sky-city-4-throne-hall')).toBeNull();
    });
});
