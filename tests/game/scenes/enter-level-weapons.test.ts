/**
 * tests/game/scenes/enter-level-weapons.test.ts
 * --------------------------------------------------------------------------
 * Walking into a level must not delete a weapon the player picked up.
 *
 * The owner's report: 猫猫给的突击步枪没了, right after stepping from the pavilion onto the
 * beach. The cat hands the rifle to the live WeaponController, which publishes it into the
 * store's `slots`; but the level-entry call built the character from `this.assets.weapons`,
 * and that list is the character's YAML `hotbar` — it has never heard of a pickup.
 *
 * `restoredWeaponsFor` is the function that reads the slots and falls back to the hotbar, and
 * the tavern refresh path was already using it. This test pins the *other* path too, because
 * the two call sites drifted apart once and that is exactly how the rifle disappeared.
 *
 * It reads the source rather than booting Phaser: the assertion is about which expression is
 * passed, and the alternative is a headless Phaser scene in a unit test.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    join(process.cwd(), 'src', 'game', 'scenes', 'scene.ts'),
    'utf8',
);

/**
 * The level-entry spawn, with comments stripped: `loadCharacter(this, this.level, this.assets.
 * character, <weapons>, {`. Matched loosely because the argument carries a multi-line comment.
 */
function levelEntryWeaponsArgument(): string {
    const withoutComments = SOURCE.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const re =
        /loadCharacter\(\s*this,\s*this\.level,\s*this\.assets\.character,\s*([\s\S]*?),\s*\{\s*placeholder:/;
    const match = withoutComments.match(re);
    return match ? match[1].replace(/\s+/g, ' ').trim() : '<not found>';
}

describe('the level-entry weapon list', () => {
    it('restores what she is carrying instead of the yaml hotbar', () => {
        expect(levelEntryWeaponsArgument()).toBe(
            'restoredWeaponsFor( this.assets.character, this.assets.weaponsById, useGameStore.getState().slots, )',
        );
    });

    it('never passes the starting hotbar to the level-entry spawn again', () => {
        // `this.assets.weapons` is the exact expression that dropped the rifle.
        expect(levelEntryWeaponsArgument()).not.toContain('this.assets.weapons,');
    });
});