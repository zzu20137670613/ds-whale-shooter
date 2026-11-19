/**
 * tests/game/monsters/anim-track.test.ts
 * --------------------------------------------------------------------------
 * Which track a monster animates on, in priority order.
 *
 * The turn track is the new one: it plays exactly once when she notices the player,
 * and it must not be able to hijack the hit flash or a running stride.
 */

import { describe, expect, it } from 'vitest';

import { monsterAnimTrack } from '@/game/monsters/logic';

const base = { isHit: false, hasTurn: true, turnUntil: 0, now: 1000, chasing: false };

describe('monsterAnimTrack', () => {
    it('idles when it is not chasing', () => {
        expect(monsterAnimTrack(base)).toBe('idle');
    });

    it('moves once the chase is on', () => {
        expect(monsterAnimTrack({ ...base, chasing: true })).toBe('move');
    });

    it('turns during the one-shot window', () => {
        expect(monsterAnimTrack({ ...base, chasing: true, turnUntil: 1400 })).toBe('turn');
    });

    it('stops turning when the window closes', () => {
        expect(monsterAnimTrack({ ...base, chasing: true, turnUntil: 900 })).toBe('move');
    });

    it('lets the hit reaction win over both', () => {
        expect(
            monsterAnimTrack({ ...base, isHit: true, chasing: true, turnUntil: 1400 }),
        ).toBe('hit');
    });

    it('ignores the turn window for a monster with no turn art', () => {
        // Every other monster in the game: no `turn` in its YAML.
        expect(
            monsterAnimTrack({ ...base, chasing: true, hasTurn: false, turnUntil: 1400 }),
        ).toBe('move');
    });
});

describe('the fall between boss phases', () => {
    const boss = { ...base, chasing: true, turnUntil: 0, fallUntil: 3000, now: 1000 };

    it('lies down while the fall window is open', () => {
        expect(monsterAnimTrack(boss)).toBe('fall');
    });

    it('gets up once it closes', () => {
        expect(monsterAnimTrack({ ...boss, now: 3000 })).toBe('move');
    });

    it('wins over the turn track, which used to steal the next frame', () => {
        // This is the bug: `advancePhase` played `death`, then the very next frame picked
        // `turn` and cut the fall off, so the owner never saw her go down.
        expect(monsterAnimTrack({ ...boss, turnUntil: 3000 })).toBe('fall');
    });

    it('still loses to a hit flash', () => {
        expect(monsterAnimTrack({ ...boss, isHit: true })).toBe('hit');
    });

    it('is off by default, so ordinary monsters never fall', () => {
        expect(monsterAnimTrack({ ...base, chasing: true })).toBe('move');
    });
});
