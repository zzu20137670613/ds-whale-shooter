/**
 * tests/store/weapon-merge.test.ts
 * --------------------------------------------------------------------------
 * Picking up a weapon you already carry upgrades it - visibly.
 *
 * The owner: `gpt踩王座是确实从天上掉下来一把白龙獠牙，但是捡了之后没有自动升级`.
 *
 * Two halves were broken:
 *   1. the store's merge bailed out when the slot mirror did not list the weapon (a fresh
 *      character never saved), so the level never moved at all;
 *   2. even when the level DID move, only the store changed - the gun in her hands kept the
 *      spec it was built with at level load, so damage stayed flat until the next scene.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from '@/store/game-store';

const RIFLE = {
    id: 'white-dragon-fangs',
    name: 'White Dragon Fangs',
    damage: 25,
    cooldownMs: 90,
    range: 560,
    clipSize: 25,
    reloadTimeMs: 1800,
    projectile: { speed: 22, visual: { radius: 5, width: 18, height: 6, color: 1 } },
    // The real file carries a ladder; without one `applyWeaponUpgrade` has nothing to apply.
    upgrades: {
        costs: [36, 80, 140, 220, 320],
        damagePerLevel: [25, 30, 30, 35, 40, 45],
    },
};

beforeEach(() => {
    // The merge only reads `slots` and `weaponLevels`, so each case sets exactly those.
    useGameStore.setState({ slots: [], weaponLevels: {} });
});

describe('a merge with the store mirror out of sync', () => {
    it('still raises the weapon level', () => {
        // No slot row at all - exactly the fresh-character case.
        useGameStore.setState({ slots: [], weaponLevels: {} });

        const merged = useGameStore.getState().mergeOwnedWeapon('white-dragon-fangs', 4);

        expect(merged).toBe(true);
        expect(useGameStore.getState().weaponLevels['white-dragon-fangs']).toBe(1);
    });

    it('refills the magazine when the mirror DOES have the slot', () => {
        useGameStore.setState({
            slots: [
                {
                    id: 'white-dragon-fangs',
                    name: 'White Dragon Fangs',
                    ammo: 3,
                    clipSize: 25,
                    reserve: 2,
                    level: 0,
                    maxLevel: 4,
                },
            ],
            weaponLevels: { 'white-dragon-fangs': 0 },
        });

        useGameStore.getState().mergeOwnedWeapon('white-dragon-fangs', 4);
        const slot = useGameStore.getState().slots[0];
        expect(slot.ammo).toBe(25);
        expect(slot.reserve).toBeGreaterThan(2);
    });

    it('stops at the ladder ceiling instead of climbing forever', () => {
        useGameStore.setState({ slots: [], weaponLevels: { 'white-dragon-fangs': 4 } });
        useGameStore.getState().mergeOwnedWeapon('white-dragon-fangs', 4);
        expect(useGameStore.getState().weaponLevels['white-dragon-fangs']).toBe(4);
    });
});

describe('the spec a live gun ends up with', () => {
    it('rises with the level, so damage moves with the number on the HUD', async () => {
        const { applyWeaponUpgrade } = await import('@/lib/weapons/upgrades');
        const base = RIFLE as never;
        // The real ladder is [25, 30, 30, 35, 40, 45] - a flat step at level 2, so comparing
        // 1 against 2 would test nothing. 1 against 3 is the honest comparison.
        const one = applyWeaponUpgrade(base, 1);
        const three = applyWeaponUpgrade(base, 3);
        expect(one.damage).toBe(30);
        expect(three.damage).toBe(35);
        expect(three.damage).toBeGreaterThan(one.damage);
    });
});