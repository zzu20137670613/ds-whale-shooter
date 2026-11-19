/**
 * tests/lib/drops/applies-on-pickup.test.ts
 * --------------------------------------------------------------------------
 * `appliesOnPickup` - which drops take effect the moment you touch them.
 *
 * The bug it fixes: `DropController.applyEffect` sent every non-weapon drop to the
 * backpack. 词元盾 has no backpack entry (`addInventoryItem` returns 0), so the pickup
 * was refused, the shield stayed on the floor, and the level never rose. The owner:
 * `捡了词元盾，徽章没有出现` - after the pillar and icon had been fixed, the pickup itself
 * was still a no-op.
 */

import { describe, expect, it } from 'vitest';

import { appliesOnPickup } from '@/lib/drops/use-check';

describe('appliesOnPickup', () => {
    it('is true for the token shield: 不进背包，拾取自动生效', () => {
        expect(appliesOnPickup({ effect: { type: 'token-shield' } } as never)).toBe(true);
    });

    it('is false for the consumables that belong in the bag', () => {
        const instant = { effect: { type: 'instant', hp: 25 } } as never;
        const refill = { effect: { type: 'refill-ammo', fraction: 1 } } as never;
        const restore = { effect: { type: 'full-restore' } } as never;
        const material = { effect: { type: 'material', materialId: 'barnacle' } } as never;
        for (const spec of [instant, refill, restore, material]) {
            expect(appliesOnPickup(spec)).toBe(false);
        }
    });

    it('is false for weapons: a hotbar slot is handled by its own branch', () => {
        expect(appliesOnPickup({ effect: { type: 'weapon', weaponId: 'assault-rifle' } } as never)).toBe(
            false,
        );
    });
});