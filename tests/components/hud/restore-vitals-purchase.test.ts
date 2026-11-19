// @vitest-environment happy-dom
/**
 * tests/components/hud/restore-vitals-purchase.test.ts
 * --------------------------------------------------------------------------
 * "补满状态" has to actually show up on the bars.
 *
 * The owner: `在进boss关之前我在亚特的神秘商人处买了一次补满状态，扣钱了，但是血蓝并未补满`.
 *
 * Two things were wrong, both pinned here:
 *   - the shop pauses the scene, and the HP/SP mirror into the store runs in the character's
 *     per-frame update - so while the panel was open every number it showed was pre-purchase
 *     (money, being a store write, updated instantly, which is exactly what he saw);
 *   - the row's "can I afford it" test used the flat 5-coin base price while the click asked
 *     for the armour-ladder price, so at high armour the button was enabled but the purchase
 *     silently failed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    canBuyRestore,
    isVitalsFull,
    restoredVitals,
    vitalsRestorePrice,
} from '@/lib/characters/vitals';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const hurt = { hp: 120, maxHp: 270, sp: 40, maxSp: 230 };

describe('what a refill produces', () => {
    it('fills both pools to their maxima', () => {
        expect(restoredVitals(hurt)).toEqual({ hp: 270, maxHp: 270, sp: 230, maxSp: 230 });
    });

    it('makes the pools read as full', () => {
        expect(isVitalsFull(restoredVitals(hurt))).toBe(true);
    });

    it('is idempotent, so a second purchase cannot inflate anything', () => {
        const once = restoredVitals(hurt);
        expect(restoredVitals(once)).toEqual(once);
    });

    it('takes the maxima from the spec, so upgrades and the pet buff are included', () => {
        // Whatever grew the pool - the armour ladder, the whale pet's percentage - arrives
        // as `maxHp` / `maxSp`. The refill must not use a hard-coded number.
        const big = { hp: 300, maxHp: 351, sp: 200, maxSp: 299 };
        expect(restoredVitals(big).hp).toBe(351);
        expect(restoredVitals(big).sp).toBe(299);
    });
});

describe('the price gate', () => {
    it('refuses a purchase the wallet cannot cover at the real price', () => {
        const price = vitalsRestorePrice(5); // 160
        expect(price).toBe(160);
        expect(canBuyRestore({ ...hurt, money: 5 }, price)).toBe(false);
    });

    it('allows it once the wallet covers the armour-ladder price', () => {
        expect(canBuyRestore({ ...hurt, money: 160 }, vitalsRestorePrice(5))).toBe(true);
    });

    it('is still disabled when the pools are already full', () => {
        expect(canBuyRestore({ ...restoredVitals(hurt), money: 999 }, 5)).toBe(false);
    });
});

describe('the wiring', () => {
    it('publishes the new vitals at once, because the shop pauses the scene', () => {
        const controller = read('src', 'game', 'characters', 'logic.ts');
        expect(controller).toContain('this.parts.hud.update(this.spec, this.hp, this.sp)');
        expect(controller).toContain('restoredVitals(this.vitals())');
    });

    it('passes the real price into the gate', () => {
        const panel = read('src', 'components', 'hud', 'shop-panel.tsx');
        expect(panel).toContain(
            'canBuyRestore({ hp, maxHp, sp, maxSp, money }, restorePrice)',
        );
    });
});