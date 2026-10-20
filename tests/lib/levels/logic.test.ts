import { describe, it, expect } from 'vitest';

import { groundLayers, isPortalArmed } from '@/lib/levels/logic';

describe('isPortalArmed', () => {
    it('arms a gated portal only once the monsters are cleared', () => {
        expect(isPortalArmed({ requiresClear: true }, false)).toBe(false);
        expect(isPortalArmed({ requiresClear: true }, true)).toBe(true);
    });

    it('arms a portal with no flag once the monsters are cleared', () => {
        expect(isPortalArmed({}, false)).toBe(false);
        expect(isPortalArmed({}, true)).toBe(true);
    });

    it('arms an always-on portal whatever the monsters are doing', () => {
        expect(isPortalArmed({ requiresClear: false }, false)).toBe(true);
        expect(isPortalArmed({ requiresClear: false }, true)).toBe(true);
    });
});

describe('groundLayers', () => {
    it('draws a plain level as one image at the origin', () => {
        expect(groundLayers('tavern', { background: 'assets/image/scenes/tavern.png' })).toEqual([
            { key: 'background:tavern', path: 'assets/image/scenes/tavern.png', x: 0, y: 0 },
        ]);
    });

    it('draws a block level as one image per block, each keyed apart', () => {
        const level = {
            background: 'assets/image/scenes/starry-library-1-counter.png',
            backgroundBlocks: [
                { texture: 'assets/image/scenes/a.png', x: 0, y: 0 },
                { texture: 'assets/image/scenes/b.png', x: 5504, y: 3072 },
            ],
        };
        expect(groundLayers('starry-library', level)).toEqual([
            { key: 'background:starry-library:0', path: 'assets/image/scenes/a.png', x: 0, y: 0 },
            {
                key: 'background:starry-library:1',
                path: 'assets/image/scenes/b.png',
                x: 5504,
                y: 3072,
            },
        ]);
    });

    it('falls back to the painted background when the block list is empty', () => {
        expect(groundLayers('tavern', { background: 'bg.png', backgroundBlocks: [] })).toEqual([
            { key: 'background:tavern', path: 'bg.png', x: 0, y: 0 },
        ]);
    });
});
