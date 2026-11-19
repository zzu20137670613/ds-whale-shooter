/**
 * tests/game/weapons/hud-mirror.test.ts
 * --------------------------------------------------------------------------
 * The weapon card's numbers must be the LIVE ones.
 *
 * The owner's report: after a reload, the magazine refilled but the reserve stayed
 * at 25 forever ("看起来像是死值"). His screenshot showed `00 / 25` - a left number
 * that was live and a right number that never moved.
 *
 * This walks the actual pipe the game uses: WeaponController slot state ->
 * WeaponHud.draw -> store. The controller itself needs Phaser, but `WeaponHud` only
 * needs something shaped like it, which is what these fakes are.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { WeaponHud } from '@/game/hubs/weapon-hud';
import type { WeaponSpec } from '@/lib/weapons';
import { useGameStore } from '@/store/game-store';

const fangs = {
    id: 'white-dragon-fangs',
    name: 'White Dragon Fangs',
    nameZh: '白龙獠牙',
    damage: 25,
    cooldownMs: 120,
    range: 550,
    clipSize: 25,
    reloadTimeMs: 1800,
    bullet: { texture: 'x.png', type: 'projectile', scale: 1, anchor: [0, 0], spawnOffset: [0, 0] },
    projectile: { speed: 20, visual: { radius: 4, width: 2, height: 2, color: 0xffffff } },
} as unknown as WeaponSpec;

/** Just enough of `WeaponController` for `WeaponHud.draw`. */
function fakeController(ammo: number, reserve: number) {
    return {
        getActiveIndex: () => 0,
        getActive: () => fangs,
        getAmmo: () => ammo,
        getMaxAmmo: () => 25,
        getReserve: () => reserve,
        isReloading: () => false,
        getReloadProgress: () => 0,
        getSlotCount: () => 1,
        getSlot: () => ({ spec: fangs, ammo, reserve }),
    } as unknown as Parameters<WeaponHud['draw']>[0];
}

describe('weapon HUD mirror', () => {
    beforeEach(() => {
        useGameStore.setState({ slots: [], activeWeaponName: '', activeAmmo: 0 });
    });

    it('carries the live reserve into the store, not the clip size', () => {
        const hud = new WeaponHud(undefined, undefined);
        hud.draw(fakeController(0, 18), 0);
        const slot = useGameStore.getState().slots[0];
        expect(slot.ammo).toBe(0);
        expect(slot.reserve).toBe(18);
        // The number the card prints on the right must be the reserve, never the
        // magazine size - those two being equal is what made a dead counter look
        // alive in the first place.
        expect(slot.reserve).not.toBe(slot.clipSize);
    });

    it('follows the reserve down as rounds move into the magazine', () => {
        const hud = new WeaponHud(undefined, undefined);
        hud.draw(fakeController(0, 25), 0);
        expect(useGameStore.getState().slots[0].reserve).toBe(25);
        hud.draw(fakeController(25, 0), 1800);
        const after = useGameStore.getState().slots[0];
        expect(after.ammo).toBe(25);
        expect(after.reserve).toBe(0);
    });
});