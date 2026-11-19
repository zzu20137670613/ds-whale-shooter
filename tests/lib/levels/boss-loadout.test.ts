/**
 * tests/lib/levels/boss-loadout.test.ts
 * --------------------------------------------------------------------------
 * The loadout the final fight hands the player.
 *
 * The owner: `其他人物打boss关时自动切换鲸鱼娘，鲸鱼娘除了自带的两种武器还要自动带上一把突击步枪，
 * 鲸鱼娘的武器和面板要全部是满级状态的，宠物buff的话跟随实际状态`.
 *
 * The pet line is the reason this is four small functions instead of one big one: the pet tier
 * is applied by `applyPetBonus` from whatever the desktop pet reports, and nothing here may
 * overwrite that with a "maxed" assumption.
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_EXTRA_WEAPON_ID,
    bossHotbar,
    fullWeaponSlot,
    maxedUpgradeLevels,
    maxedWeaponLevels,
} from '@/lib/levels/boss-loadout';
import { parseCharacterYaml } from '@/lib/characters/parser';
import { parseWeaponYaml } from '@/lib/weapons/parser';
import { reserveMaxFor } from '@/lib/weapons/ammo';

const CHARACTER = parseCharacterYaml(
    `
id: deepseek
name: Whale Girl
hp: 190
sp: 170
moveSpeed: 5
body: { halfW: 16, halfH: 16 }
dodge: { spCost: 10, speed: 12, durationMs: 200, cooldownMs: 500 }
hotbar: [whale-cannon, whale-tail-slam]
upgrades:
    armor: { costs: [30, 60, 100, 150, 220], effects: [{ stat: armor, mode: add, perLevel: 5 }] }
    agility: { costs: [40, 80, 130, 190, 270], effects: [{ stat: moveSpeed, mode: add, perLevel: 0.3 }] }
    hp: { costs: [35, 70, 115, 170, 240], effects: [{ stat: hp, mode: add, perLevel: 20 }] }
    spirit: { costs: [35, 70, 115, 170, 240], effects: [{ stat: sp, mode: add, perLevel: 10 }] }
    luck: { costs: [80, 160], effects: [{ stat: luck, mode: add, perLevel: 1 }] }
`,
    'deepseek',
);

const RIFLE = parseWeaponYaml(
    `
name: Assault Rifle
damage: 4
cooldownMs: 120
range: 600
clipSize: 35
reloadTimeMs: 1400
projectile:
    speed: 26
    visual: { radius: 3, width: 14, height: 3, color: 1 }
upgrades:
    costs: [50, 100]
    damageMulPerLevel: 1.1
`,
    'assault-rifle',
);

const CANNON = parseWeaponYaml(
    `
name: Whale Cannon
damage: 30
cooldownMs: 900
range: 500
clipSize: 5
reloadTimeMs: 2400
projectile:
    speed: 18
    visual: { radius: 6, width: 20, height: 20, color: 1 }
`,
    'whale-cannon',
);

const BY_ID = new Map([
    ['assault-rifle', RIFLE],
    ['whale-cannon', CANNON],
]);

describe('the panel is maxed', () => {
    it('puts every ladder on its top rung', () => {
        expect(maxedUpgradeLevels(CHARACTER)).toEqual({
            armor: 5,
            agility: 5,
            hp: 5,
            spirit: 5,
            // A two-deep ladder maxes at 2, not at the five the others happen to have.
            luck: 2,
        });
    });

    it('is empty for a character with no ladders', () => {
        expect(maxedUpgradeLevels({ ...CHARACTER, upgrades: undefined } as never)).toEqual({});
    });
});

describe('the guns are maxed', () => {
    it('reads each weapon’s own ladder length', () => {
        expect(maxedWeaponLevels(['assault-rifle', 'whale-cannon'], BY_ID)).toEqual({
            'assault-rifle': 2,
            // No ladder at all - the cannon stays at 0 and is still maxed.
            'whale-cannon': 0,
        });
    });

    it('skips ids the map does not know', () => {
        expect(maxedWeaponLevels(['ghost-gun'], BY_ID)).toEqual({});
    });
});

describe('the rifle is added once', () => {
    it('appends it to her two starting weapons', () => {
        expect(bossHotbar(['whale-cannon', 'whale-tail-slam'])).toEqual([
            'whale-cannon',
            'whale-tail-slam',
            BOSS_EXTRA_WEAPON_ID,
        ]);
    });

    it('does not add a second copy when she already carries one', () => {
        const hotbar = ['whale-cannon', BOSS_EXTRA_WEAPON_ID];
        expect(bossHotbar(hotbar)).toEqual(hotbar);
    });
});

describe('the handed-over rifle', () => {
    it('comes with a full magazine and a full reserve at its maxed level', () => {
        const slot = fullWeaponSlot('assault-rifle', BY_ID, 2, (spec) => spec.name)!;
        expect(slot.ammo).toBe(35);
        expect(slot.clipSize).toBe(35);
        expect(slot.reserve).toBe(reserveMaxFor(35, 2));
    });

    it('is null when the weapon is not in the map', () => {
        expect(fullWeaponSlot('ghost-gun', BY_ID, 0, () => 'x')).toBeNull();
    });
});