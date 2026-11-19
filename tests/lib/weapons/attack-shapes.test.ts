/**
 * tests/lib/weapons/attack-shapes.test.ts
 * --------------------------------------------------------------------------
 * The attack rhythms and shapes the owner dictated on 2026-11-11.
 *
 *   `突击步枪改为… 白龙獠牙改为200（0.2秒一发）`
 *   `四个远程怪统一改成1000（1.00发/秒）`
 *   `鲸娘重炮…二段攻击` / `墨壶迫击改为三连击` / `灭妖符改为扇形的5发` / `秘法杖改为连锁攻击`
 *
 * Every one of those is data on a weapon spec, so this file reads the YAML the same way the
 * game does - if a number drifts back, the spec is what fails, not a player's playtest.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseWeaponYaml } from '@/lib/weapons/parser';

const DIR = join(process.cwd(), 'public', 'data', 'weapons');
const load = (id: string) =>
    parseWeaponYaml(readFileSync(join(DIR, `${id}.yaml`), 'utf8'), id);

describe('the guns the player holds', () => {
    it('assault rifle fires eight rounds a second', () => {
        // 主人 2026-11-15：`突击步枪每秒8发`。1000 / 8 = 125ms。
        expect(load('assault-rifle').cooldownMs).toBe(125);
    });

    it('white dragon fangs fire six shots a second, two bullets each', () => {
        // 主人 2026-11-15：`白龙獠牙每秒6发*2弹丸`。1000 / 6 ≈ 167ms。
        const fangs = load('white-dragon-fangs');
        expect(fangs.cooldownMs).toBe(167);
        expect(fangs.bulletsPerShot).toBe(2);
    });
});

describe('the four ranged monsters', () => {
    it('all shoot once a second', () => {
        // sniper / gunner / drone-ultra / bengbu-erba - the shooters the painted levels use.
        for (const id of ['moss-bark-rifle', 'thorn-bolt', 'bramble-knuckles', 'fish-spear']) {
            expect(load(id).cooldownMs, id).toBe(1000);
        }
    });
});

describe('whale cannon: two-stage shell', () => {
    it('schedules a second blast 0.1s after the first lands', () => {
        expect(load('whale-cannon').secondaryBlastMs).toBe(100);
    });

    it('opens a 120px second circle, a round number on purpose', () => {
        // 主人：`二次圈半径120吧，凑整好维护`。
        expect(load('whale-cannon').secondaryBlastRadius).toBe(120);
    });
});

describe('inkwell mortar: three shells per trigger', () => {
    it('fires three, spaced out', () => {
        const mortar = load('inkwell-mortar');
        expect(mortar.bulletsPerShot).toBe(3);
        expect(mortar.burstDelayMs).toBe(130);
    });

    it('keeps its five-round magazine', () => {
        expect(load('inkwell-mortar').clipSize).toBe(5);
    });
});

describe('exorcism talisman: five-shot fan', () => {
    it('throws five talismans at once', () => {
        const talisman = load('exorcism-talisman');
        expect(talisman.bulletsPerShot).toBe(5);
        expect(talisman.spreadDeg).toBeGreaterThan(16);
    });
});

describe('arcana staff: chain', () => {
    it('jumps twice with 70% then 40% damage', () => {
        const chain = load('arcana-staff').chain;
        expect(chain?.count).toBe(2);
        expect(chain?.scales).toEqual([0.7, 0.4]);
    });

    it('stops chaining after 1500px of travel', () => {
        // 两段加起来的上限，主人定的 1500。
        expect(load('arcana-staff').chain?.maxDistance).toBe(1500);
    });

    it('still fires a single bolt to start with', () => {
        expect(load('arcana-staff').bulletsPerShot ?? 1).toBe(1);
    });
});