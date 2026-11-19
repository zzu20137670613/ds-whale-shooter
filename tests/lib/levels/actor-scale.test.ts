/**
 * tests/lib/levels/actor-scale.test.ts
 * --------------------------------------------------------------------------
 * A character should read at the same size in every room whose furniture implies a
 * human. The tavern and the dev cabin draw their interiors at a much larger scale than
 * the character sheets, so both need a multiplier; everywhere else stays 1:1.
 */

import { describe, expect, it } from 'vitest';

import { TAVERN_ACTOR_SCALE } from '@/lib/constants';
import { DEV_CABIN_ACTOR_SCALE, actorScaleFor } from '@/lib/levels/actor-scale';

describe('actorScaleFor', () => {
    it('leaves ordinary levels at the sheet scale', () => {
        for (const id of ['beach-holiday',
              'starry-library-2-counter',
              'gpt-sky-city-4-throne-hall',
              'dsh-atlantis-4-coronation-dais']) {
            expect(actorScaleFor(id), id).toBe(1);
        }
    });

    it('scales the tavern to its furniture', () => {
        expect(actorScaleFor('tavern')).toBe(TAVERN_ACTOR_SCALE);
    });

    it('scales the dev cabin further than the tavern', () => {
        // The cabin's desk chair is drawn larger than the tavern's bar stools.
        expect(actorScaleFor('dev-cabin')).toBe(DEV_CABIN_ACTOR_SCALE);
        expect(DEV_CABIN_ACTOR_SCALE).toBeGreaterThan(TAVERN_ACTOR_SCALE);
    });

    it('never returns zero or a negative, which would hide the sprite', () => {
        for (const id of ['tavern', 'dev-cabin', 'anything-else']) {
            expect(actorScaleFor(id)).toBeGreaterThan(0);
        }
    });
});