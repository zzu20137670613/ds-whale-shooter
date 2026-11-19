/**
 * tests/lib/weapons/card-scale.test.ts
 * --------------------------------------------------------------------------
 * Chunky card art must not run down over the weapon's name.
 *
 * The owner: `将武器卡上的鹤扇和灭妖符都等比缩小一点，不要压到武器名字`.
 *
 * The card is a fixed frame: hotkey on top, name + ammo in a column at the bottom, and the
 * weapon art behind both. A gun is narrow enough that 90px of art clears the name line; a fan
 * (tall) and a talisman (wide) are not. `cardScale` is the per-weapon dial, default 1.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const ROOT = process.cwd();
const load = (id: string) =>
    parseWeaponYaml(readFileSync(join(ROOT, 'public', 'data', 'weapons', `${id}.yaml`), 'utf8'), id);

/** The drawn box the HUD card would use for a slot. */
function cardBox(visual?: {
    cardRotation?: number;
    cardScale?: number;
}) {
    const rotation = visual?.cardRotation ?? -90;
    const scale = visual?.cardScale ?? 1;
    const vertical = rotation === 0;
    return {
        width: vertical ? undefined : 90 * scale,
        height: vertical ? 128 * scale : undefined,
        maxWidth: 90 * scale,
        maxHeight: 150 * scale,
    };
}

describe('the two chunky weapons', () => {
    for (const id of ['crane-fan', 'exorcism-talisman']) {
        it(`${id} draws smaller than the house size`, () => {
            const spec = load(id);
            expect(spec.visual?.cardScale).toBeGreaterThan(0.5);
            expect(spec.visual?.cardScale).toBeLessThan(0.85);
        });

        it(`${id} keeps its art below the name band`, () => {
            const box = cardBox(load(id).visual ?? undefined);
            // The name row sits in roughly the bottom third of a ~150px card.
            const bottom = (box.height ?? box.width ?? 0) > 0 ? box.maxHeight! : 0;
            expect(bottom).toBeLessThanOrEqual(150 * 0.75);
        });
    }

    it('the fan is still upright and the talisman still sideways', () => {
        expect(load('crane-fan').visual?.cardRotation).toBe(0);
        expect(load('exorcism-talisman').visual?.cardRotation ?? -90).toBe(-90);
    });
});

describe('everyone else', () => {
    it('keeps the house size', () => {
        for (const id of ['assault-rifle', 'whale-tail-slam', 'scripture', 'white-dragon-fangs']) {
            const spec = load(id);
            expect(spec.visual?.cardScale ?? 1).toBe(1);
        }
    });

    it('so the card maths is unchanged for them', () => {
        const box = cardBox(load('assault-rifle').visual ?? undefined);
        expect(box.width).toBe(90);
        expect(box.maxHeight).toBe(150);
    });
});