/**
 * tests/game/monsters/remaining-wiring.test.ts
 * --------------------------------------------------------------------------
 * 剩余怪物数 has to be published from the frame loop, not from a swing.
 *
 * The owner: `剩余怪物数的算法好像不太对，没有随着怪物的减少实时变化`. He was right: the call had
 * been inserted at the end of `performMelee`, so the counter only refreshed when a monster
 * took a swing at him - on a map where nothing reached him, it never moved at all.
 *
 * Wiring like this cannot be caught by a unit test of the arithmetic, so this file checks the
 * shape of the source: the publish belongs at the end of `update()`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    join(process.cwd(), 'src', 'game', 'monsters', 'monster.ts'),
    'utf8',
);

/** The body of a method, by brace-free slice: from its signature to the next method. */
function methodBody(name: string): string {
    const lines = SOURCE.split('\n');
    const start = lines.findIndex((line) => line.includes(`${name}(`) && !line.trim().startsWith('this.'));
    expect(start, `${name} not found`).toBeGreaterThan(-1);
    const next = lines.findIndex(
        (line, index) => index > start && /^    \w[\w ]*\(/.test(line) && !line.includes(name),
    );
    return lines.slice(start, next === -1 ? undefined : next).join('\n');
}

describe('the remaining-monster publish', () => {
    it('runs at the end of the frame loop', () => {
        expect(methodBody('update')).toContain('this.publishRemaining()');
    });

    it('is not hiding inside the melee swing any more', () => {
        // This is the exact place the bug lived.
        expect(methodBody('performMelee')).not.toContain('this.publishRemaining()');
    });

    it('is emitted once per change, not once per frame', () => {
        const body = methodBody('private publishRemaining');
        expect(body).toContain('this.lastRemaining');
        expect(body).toContain(MONSTERS_EVENT);
    });

    it('counts dying monsters as gone', () => {
        // `remainingCount` lives in the lib; see its own test for the arithmetic.
        expect(SOURCE).toContain('remainingCount(this.monsters)');
    });
});

/** The event name, inlined so this file does not import the module it is auditing. */
const MONSTERS_EVENT = 'MONSTERS_REMAINING_EVENT';