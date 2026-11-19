import { describe, it, expect } from 'vitest';

import {
    arcPoint,
    armedTriggers,
    groundLayers,
    isInsideZone,
    isPortalArmed,
    propKey,
    spawnsWithoutBrokenProps,
    triggerKey,
} from '@/lib/levels/logic';

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

describe('propKey / spawnsWithoutBrokenProps', () => {
    it('keys a prop by its level and monster type', () => {
        expect(propKey('tavern', 'hollow-emblem')).toBe('tavern:hollow-emblem');
    });

    it('drops the prop spawns the player has already opened', () => {
        const spawns = [
            { type: 'hollow-emblem', x: 2642, y: 896 },
            { type: 'drone', x: 900, y: 600 },
        ];
        expect(spawnsWithoutBrokenProps('tavern', spawns, ['tavern:hollow-emblem'])).toEqual([
            { type: 'drone', x: 900, y: 600 },
        ]);
    });

    it('keeps every spawn while nothing has been opened', () => {
        const spawns = [{ type: 'hollow-emblem', x: 2642, y: 896 }];
        expect(spawnsWithoutBrokenProps('tavern', spawns, [])).toEqual(spawns);
        expect(spawnsWithoutBrokenProps('tavern', undefined, [])).toBeUndefined();
    });

    it('only drops the key belonging to that level', () => {
        const spawns = [{ type: 'hollow-emblem', x: 2642, y: 896 }];
        expect(spawnsWithoutBrokenProps('beach-holiday', spawns, ['tavern:hollow-emblem'])).toEqual(
            spawns,
        );
    });
});

describe('triggerKey / isInsideZone / armedTriggers / arcPoint', () => {
    it('keys a trigger by its level and id', () => {
        expect(triggerKey('beach-holiday', 'lounger-juice')).toBe('beach-holiday:lounger-juice');
    });

    it('counts the zone edges as inside', () => {
        const zone = { x: 100, y: 200, width: 50, height: 40 };
        expect(isInsideZone(zone, 100, 200)).toBe(true);
        expect(isInsideZone(zone, 150, 240)).toBe(true);
        expect(isInsideZone(zone, 125, 220)).toBe(true);
        expect(isInsideZone(zone, 99, 200)).toBe(false);
        expect(isInsideZone(zone, 125, 241)).toBe(false);
    });

    it('drops the triggers that already fired this run', () => {
        const triggers = [{ id: 'lounger-juice' }, { id: 'other' }];
        expect(armedTriggers('beach-holiday', triggers, ['beach-holiday:lounger-juice'])).toEqual([
            { id: 'other' },
        ]);
    });

    it('keeps a trigger recorded in another level, and copes with no triggers', () => {
        const triggers = [{ id: 'lounger-juice' }];
        expect(armedTriggers('beach-holiday', triggers, ['tavern:lounger-juice'])).toEqual(
            triggers,
        );
        expect(armedTriggers('beach-holiday', undefined, [])).toEqual([]);
    });

    it('arcs a pickup up and back down exactly onto its target', () => {
        const from = { x: 0, y: 0 };
        const to = { x: 200, y: 0 };
        expect(arcPoint(from, to, 0, 90)).toEqual({ x: 0, y: 0 });
        expect(arcPoint(from, to, 1, 90)).toEqual({ x: 200, y: 0 });
        expect(arcPoint(from, to, 0.5, 90)).toEqual({ x: 100, y: -90 });
        expect(arcPoint(from, to, 0.25, 90).y).toBeLessThan(arcPoint(from, to, 0.125, 90).y);
    });

    it('clamps an out-of-range t to the endpoints', () => {
        expect(arcPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, -1, 50)).toEqual({ x: 0, y: 0 });
        expect(arcPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 2, 50)).toEqual({ x: 10, y: 10 });
    });
});
