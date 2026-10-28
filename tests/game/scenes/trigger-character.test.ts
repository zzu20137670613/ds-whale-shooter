/**
 * tests/game/scenes/trigger-character.test.ts
 * --------------------------------------------------------------------------
 * The Sky City throne egg, driven through the shipped level YAML.
 *
 * Two things have to hold: only GPT can set it off, and standing on it as anyone
 * else must leave it ARMED - a save must not lose the egg because Claude walked
 * past the chair first.
 *
 * The merge-on-duplicate rule is checked here too, because both easter eggs rely
 * on it: picking up a weapon you already carry is one upgrade level and a full
 * load, not a second slot.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TriggerController } from '@/game/scenes/trigger';
import { parseLevelYaml } from '@/lib/levels/parser';
import { initialGameState, useGameStore } from '@/store/game-store';
import type { DropSpec } from '@/lib/drops';
import type { WeaponSpec } from '@/lib/weapons/types';

const LEVEL_ID = 'gpt-sky-city';
const level = parseLevelYaml(
    readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${LEVEL_ID}.yaml`), 'utf8'),
    LEVEL_ID,
);

const EGG = 'dragon-throne-fangs';
const trigger = level.triggers?.find((t) => t.id === EGG);
if (!trigger) throw new Error('the throne egg is missing from gpt-sky-city.yaml');

const dropSpec = { id: 'weapon-drop' } as DropSpec;
const weaponSpec = { id: 'white-dragon-fangs' } as WeaponSpec;
const FRAME = 16;

function harness() {
    const sprite = { setPosition: vi.fn(), setDepth: vi.fn() };
    const drop = { sprite, rejected: false };
    // Typed so the assertion can read the weapon argument it was called with.
    const spawnWeaponLanded = vi.fn((_spec: DropSpec, _weapon: WeaponSpec) => drop);
    const character = { body: { position: { x: 0, y: 0 } } };
    const controller = new TriggerController(
        character,
        LEVEL_ID,
        level.triggers,
        { spawnLanded: vi.fn(() => drop), spawnWeaponLanded } as never,
        () => dropSpec,
        undefined,
        () => useGameStore.getState().selectedCharacterId,
        () => weaponSpec,
    );
    return { controller, character, spawnWeaponLanded, drop };
}

/** The middle of the authored zone. */
const ON_THE_SEAT = {
    x: trigger.zone.x + trigger.zone.width / 2,
    y: trigger.zone.y + trigger.zone.height / 2,
};

describe('the Sky City throne egg', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('ships guarded by a character allow list', () => {
        expect(trigger).toHaveProperty('onlyCharacters');
        expect((trigger as { onlyCharacters?: string[] }).onlyCharacters).toEqual(['gpt']);
    });

    it('drops the White Dragon Fangs for GPT', () => {
        useGameStore.setState({ selectedCharacterId: 'gpt' });
        const { controller, character, spawnWeaponLanded } = harness();
        character.body.position = { ...ON_THE_SEAT };

        controller.update(FRAME);

        expect(spawnWeaponLanded).toHaveBeenCalledTimes(1);
        expect(spawnWeaponLanded.mock.calls[0]?.[1]).toBe(weaponSpec);
        expect(useGameStore.getState().usedTriggers).toContain(`${LEVEL_ID}:${EGG}`);
    });

    it('refuses every other character and stays armed', () => {
        for (const who of ['claude', 'deepseek', 'qwen', 'seed']) {
            useGameStore.setState({ ...initialGameState, selectedCharacterId: who });
            const { controller, character, spawnWeaponLanded } = harness();
            character.body.position = { ...ON_THE_SEAT };

            controller.update(FRAME);

            expect(spawnWeaponLanded, who).not.toHaveBeenCalled();
            expect(useGameStore.getState().usedTriggers, who).not.toContain(
                `${LEVEL_ID}:${EGG}`,
            );
        }
    });
});

describe('merging a duplicate weapon', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    const slot = {
        id: 'assault-rifle',
        name: 'Assault Rifle',
        ammo: 3,
        clipSize: 35,
        reserve: 0,
    };

    it('is one level up and a full load', () => {
        useGameStore.setState({ slots: [slot as never], weaponLevels: {} });

        const merged = useGameStore.getState().mergeOwnedWeapon('assault-rifle', 5);

        expect(merged).toBe(true);
        const after = useGameStore.getState();
        expect(after.weaponLevels['assault-rifle']).toBe(1);
        expect(after.slots[0].ammo).toBe(35);
        // Reserve is clipSize * (2 + level) = 35 * 3.
        expect(after.slots[0].reserve).toBe(105);
    });

    it('refuses a weapon the character does not carry', () => {
        useGameStore.setState({ slots: [], weaponLevels: {} });
        expect(useGameStore.getState().mergeOwnedWeapon('white-dragon-fangs', 5)).toBe(false);
        expect(useGameStore.getState().weaponLevels['white-dragon-fangs']).toBeUndefined();
    });

    it('still refills once the ladder is maxed', () => {
        useGameStore.setState({ slots: [slot as never], weaponLevels: { 'assault-rifle': 5 } });

        useGameStore.getState().mergeOwnedWeapon('assault-rifle', 5);

        const after = useGameStore.getState();
        expect(after.weaponLevels['assault-rifle']).toBe(5);
        expect(after.slots[0].ammo).toBe(35);
        expect(after.slots[0].reserve).toBe(35 * 7);
    });
});

describe('the cat shop', () => {
    beforeEach(() => {
        useGameStore.setState({ ...initialGameState });
    });

    it('gives its rifle once per save and renames the panel', () => {
        const first = useGameStore.getState().openCatShop();
        const after = useGameStore.getState();
        expect(first).toBe(true);
        expect(after.shopTitleKey).toBe('shop.catTitle');
        expect(after.merchantReady).toBe(true);
        expect(after.catShopGiftGiven).toBe(true);

        // Closing and clicking again must not hand out a second rifle.
        useGameStore.getState().setMerchantReady(false);
        expect(useGameStore.getState().openCatShop()).toBe(false);
    });
});