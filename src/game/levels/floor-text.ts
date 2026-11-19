/**
 * src/game/levels/floor-text.ts
 * --------------------------------------------------------------------------
 * Words printed on the floor.
 *
 * The hidden map is a placeholder until its art exists, and the owner wants the placeholder
 * to explain itself where the player is standing: how to make the map, how to drop the art
 * in, and how to ask him for a bespoke one. That means the LEVEL has to own text, so
 * `floorText` is a level field and this module draws it.
 *
 * Depth is `MATERIAL_BACKGROUND + 1`: above the painted background, below anything that can
 * walk. Writing on the floor should never cover a character's feet.
 */

import type Phaser from 'phaser';

import { DEPTH } from '@/lib/constants';
import type { FloorText } from '@/lib/levels';

/** Defaults, so a level only has to give a position and a string. */
export const FLOOR_TEXT_DEFAULT_SIZE = 30;
export const FLOOR_TEXT_DEFAULT_COLOUR = '#fde68a';
export const FLOOR_TEXT_DEFAULT_ALIGN = 'center';

/** Draw every entry, and return the objects so a shutdown can destroy them. */
export function drawFloorText(
    scene: Phaser.Scene,
    entries: readonly FloorText[] | undefined,
): Phaser.GameObjects.Text[] {
    if (!entries?.length) return [];

    const drawn: Phaser.GameObjects.Text[] = [];
    for (const entry of entries) {
        const label = scene.add.text(entry.x, entry.y, entry.text, {
            fontFamily: 'Silkscreen, monospace',
            fontSize: `${entry.fontSize ?? FLOOR_TEXT_DEFAULT_SIZE}px`,
            color: entry.color ?? FLOOR_TEXT_DEFAULT_COLOUR,
            align: entry.align ?? FLOOR_TEXT_DEFAULT_ALIGN,
            // A dark halo so cream text still reads on a pale floor.
            stroke: '#1c1917',
            strokeThickness: 5,
        });
        label.setOrigin(0.5, 0.5);
        label.setDepth(DEPTH.MATERIAL_BACKGROUND + 1);
        drawn.push(label);
    }
    return drawn;
}