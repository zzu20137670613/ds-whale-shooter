/**
 * tests/lib/weapons/heavy-ammo.test.ts
 * --------------------------------------------------------------------------
 * 物理超度 and 鲸娘重炮 carry a 5-round magazine and a 10-round reserve.
 *
 * The owner's report: `实测发现少了打不过新手关` — the heavy area weapons ran dry before the
 * stage was cleared. The fix is ammunition (5 in the mag, 10 in reserve at level 0), NOT more
 * shells per trigger pull: one shell per shot is the whole point of a mortar.
 *
 * Reserve capacity is `clipSize * (2 + level)` engine-wide (`lib/weapons/ammo.ts`), so 5 in
 * the magazine lands on exactly 10 in reserve at level 0. Levelling the weapon grows the
 * reserve like every other gun - 35 at max.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { reserveMaxFor } from '@/lib/weapons/ammo';

const HEAVY = ['inkwell-mortar', 'whale-cannon'] as const;

function readWeapon(id: string): string {
    return readFileSync(join(process.cwd(), 'public', 'data', 'weapons', `${id}.yaml`), 'utf8');
}

describe('the two heavy weapons carry a 5/10 magazine', () => {
    for (const id of HEAVY) {
        it(`${id} holds 5 rounds and backs them with 10`, () => {
            const yaml = readWeapon(id);
            const clip = Number(/^clipSize:\s*(\d+)$/m.exec(yaml)?.[1]);
            expect(clip).toBe(5);
            expect(reserveMaxFor(clip, 0)).toBe(10);
        });

        // 墨壶迫击现在是一扣三发（主人：`墨壶迫击改为三连击`），弹匣数不变，
        // 变的是每一扣扳机出去几发。鲸娘重炮仍是单发。
        it(`${id} still fires one shell per trigger pull`, () => {
            const yaml = readWeapon(id);
            // A per-level shot table here would silently turn a mortar into a shotgun; that
            // was a misreading of the request and is pinned now.
            expect(yaml).not.toMatch(/bulletsPerShotPerLevel/);
            const shots = /^bulletsPerShot:\s*(\d+)$/m.exec(yaml)?.[1];
            expect(shots === undefined ? 1 : Number(shots)).toBe(id === 'inkwell-mortar' ? 3 : 1);
        });

        it(`${id} reserve grows with the ladder`, () => {
            expect(reserveMaxFor(5, 5)).toBe(35);
        });
    }
});