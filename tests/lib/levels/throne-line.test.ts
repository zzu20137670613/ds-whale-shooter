/**
 * tests/lib/levels/throne-line.test.ts
 * --------------------------------------------------------------------------
 * The White Dragon Fangs seat.
 *
 * The trigger zone used to be a 110px strip hugging the wall, so standing half a step low
 * missed it (`贴着椅子找没到碰到白龙獠牙`). It is now the whole seat plus its approach, and it
 * lives in the throne-hall level that owns that block.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';

const LEVEL_ID = 'gpt-sky-city-4-throne-hall';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);

const throne = (level.triggers ?? [])
    .filter((trigger) => trigger.id === 'dragon-throne-fangs')
    .find((trigger) => 'spawn' in trigger);

/**
 * Narrowed once: the trigger list is a union of spawn and travel triggers, and a missing
 * one must fail loudly here rather than as a TypeError two assertions later.
 */
const fangs =
    throne && 'spawn' in throne ? throne : (null as never as NonNullable<typeof throne>);

describe('the throne', () => {
    it('is authored in the throne hall', () => {
        expect(throne).toBeDefined();
    });

    it('arms over the whole seat, not a strip against the wall', () => {
        if (!throne) throw new Error('no throne');
        expect(fangs.zone.width).toBeGreaterThanOrEqual(400);
        expect(fangs.zone.height).toBeGreaterThanOrEqual(300);
    });

    it('stays inside the level', () => {
        const z = fangs.zone;
        expect(z.x).toBeGreaterThanOrEqual(0);
        expect(z.y).toBeGreaterThanOrEqual(0);
        expect(z.x + z.width).toBeLessThanOrEqual(level.imageSize.width);
        expect(z.y + z.height).toBeLessThanOrEqual(level.imageSize.height);
    });

    it('drops the fangs on the seat', () => {
        if (!throne || !('spawn' in throne)) throw new Error('the fangs trigger is missing');
        const spawn = fangs.spawn;
        expect(spawn.weaponId).toBe('white-dragon-fangs');
        const z = fangs.zone;
        const inside =
            spawn.to.x >= z.x - 200 &&
            spawn.to.x <= z.x + z.width + 200 &&
            spawn.to.y >= z.y - 200 &&
            spawn.to.y <= z.y + z.height + 200;
        expect(inside).toBe(true);
    });

    it('plays the dragon video once the drop lands', () => {
        if (!throne || !('video' in throne)) throw new Error('the fangs video is missing');
        expect(fangs.video).toBe('assets/video/night-of-dragons.mp4');
    });

    it('gives GPT her own line and everyone else the default', () => {
        if (!throne || !('line' in throne) || !fangs.line) throw new Error('no lines');
        const line = fangs.line as Record<string, string>;
        expect(line.default.length).toBeGreaterThan(0);
        expect(line.gpt.length).toBeGreaterThan(0);
        expect(line.gpt).not.toBe(line.default);
    });
});
