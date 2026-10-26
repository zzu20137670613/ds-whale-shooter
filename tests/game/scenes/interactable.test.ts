/**
 * tests/game/scenes/interactable.test.ts
 * --------------------------------------------------------------------------
 * Click targets that are painted into the art.
 *
 * These rectangles are authored against a painting, so the failure mode is
 * silent: a zone five pixels off still hits on the big screen and misses on the
 * small one, and nothing complains. Hence the shipped-YAML test at the bottom:
 * the cabin's zones are checked against the numbers the owner marked, not
 * against numbers this file invented.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InteractableController } from '@/game/scenes/interactable';
import { parseLevelYaml } from '@/lib/levels/parser';

const laptop = { x: 1120, y: 303, width: 289, height: 182 };
const monitor = { x: 1513, y: 319, width: 338, height: 263 };

const mail = { id: 'dev-mail', action: 'dev-mail', zones: [laptop, monitor] };

describe('InteractableController', () => {
    it('hits the middle of a zone', () => {
        const c = new InteractableController([mail]);
        expect(c.at(1200, 400)?.id).toBe('dev-mail');
    });

    it('hits either of two zones belonging to the same target', () => {
        const c = new InteractableController([mail]);
        expect(c.at(1200, 400)?.id).toBe('dev-mail');
        expect(c.at(1650, 450)?.id).toBe('dev-mail');
    });

    it('includes the edges - a zone that ends one pixel early feels broken', () => {
        const c = new InteractableController([mail]);
        expect(c.at(laptop.x, laptop.y)?.id).toBe('dev-mail');
        expect(c.at(laptop.x + laptop.width, laptop.y + laptop.height)?.id).toBe('dev-mail');
    });

    it('misses just outside every zone', () => {
        const c = new InteractableController([mail]);
        expect(c.at(laptop.x - 1, laptop.y)).toBeNull();
        expect(c.at(0, 0)).toBeNull();
        expect(c.at(2751, 1535)).toBeNull();
    });

    it('lets a later, precise target override an earlier broad one', () => {
        const broad = {
            id: 'desk',
            action: 'look',
            zones: [{ x: 900, y: 200, width: 1300, height: 900 }],
        };
        const c = new InteractableController([broad, mail]);
        expect(c.at(1200, 400)?.id).toBe('dev-mail');
        expect(c.at(950, 250)?.id).toBe('desk');
    });

    it('copes with a level that has none', () => {
        expect(new InteractableController(undefined).at(1200, 400)).toBeNull();
    });
});

describe('the shipped cabin level', () => {
    const level = parseLevelYaml(
        readFileSync(join(process.cwd(), 'public', 'data', 'levels', 'dev-cabin.yaml'), 'utf8'),
        'dev-cabin',
    );

    it('ships exactly one interactable: the desk mail', () => {
        expect(level.interactables).toHaveLength(1);
        expect(level.interactables?.[0].action).toBe('dev-mail');
    });

    it('has both screens as targets, at the coordinates marked on the art', () => {
        const zones = level.interactables?.[0].zones ?? [];
        expect(zones).toHaveLength(2);
        expect(zones[0]).toEqual(laptop);
        expect(zones[1]).toEqual(monitor);
    });
});
