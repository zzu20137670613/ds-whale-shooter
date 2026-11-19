/**
 * tests/lib/drops/juice-anywhere.test.ts
 * --------------------------------------------------------------------------
 * The iced juice hands over the arcana staff in ANY level, for Gemini and for GPT.
 *
 * The owner: `冰镇果汁带到其他地图引用时会不会出现武器，在哪个地图都有可能使用，需要保证哪个
 * 地图使用都可以拿到秘法权杖（除了Gemini也检查一下gpt的）`.
 *
 * Three separate things had to be true, and each was checked:
 *   1. the joke names the staff for both characters (this file),
 *   2. the staff's spec+texture are resident in every scene (resolve-scene),
 *   3. a full-health drink is not refused, which used to swallow the whole egg (drop.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    GEMINI_JUICE_LINE,
    GEMINI_JUICE_WEAPON_ID,
    GPT_JUICE_LINE,
    JUICE_LINE,
    juiceEasterEgg,
} from '@/lib/drops/easter-eggs';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('who gets the staff', () => {
    it('gives Gemini the arcana staff and her own line', () => {
        expect(juiceEasterEgg('gemini', 'iced-juice')).toEqual({
            weaponId: GEMINI_JUICE_WEAPON_ID,
            line: GEMINI_JUICE_LINE,
        });
        expect(GEMINI_JUICE_WEAPON_ID).toBe('arcana-staff');
    });

    it('gives GPT the same staff, with 嗷 instead of 喵', () => {
        const egg = juiceEasterEgg('gpt', 'iced-juice');
        expect(egg?.weaponId).toBe('arcana-staff');
        expect(egg?.line).toBe(GPT_JUICE_LINE);
        expect(egg?.line).toContain('嗷');
        expect(egg?.line).not.toContain('喵');
    });

    it('gives everyone else only the line', () => {
        for (const id of ['deepseek', 'qwen', 'claude']) {
            expect(juiceEasterEgg(id, 'iced-juice')).toEqual({ line: JUICE_LINE });
        }
    });

    it('says nothing for any other drink or with no character', () => {
        expect(juiceEasterEgg('gemini', 'hp-shard')).toBeNull();
        expect(juiceEasterEgg(null, 'iced-juice')).toEqual({ line: JUICE_LINE });
    });
});

describe('the staff is resident everywhere', () => {
    it('is loaded by the level resolver, not only by the map that spawns the drink', () => {
        // A texture cannot be fetched after boot: without this the staff would be added to
        // the hotbar and drawn invisible in any level that never mentions it.
        const resolver = read('src', 'game', 'resolve-scene.ts');
        expect(resolver).toContain('JUICE_EGG_WEAPON_ID');
        expect(resolver).toMatch(/spawnWeaponIds\.add\(JUICE_EGG_WEAPON_ID\)/);
    });

    it('and the weapon file exists', () => {
        expect(() =>
            readFileSync(join(ROOT, 'public', 'data', 'weapons', 'arcana-staff.yaml')),
        ).not.toThrow();
    });
});

describe('drinking it', () => {
    const drop = () => read('src', 'game', 'drops', 'drop.ts');

    it('is not refused at full health', () => {
        // `full-restore` would otherwise reject the click and take the staff with it.
        expect(drop()).toMatch(/!egg &&\s*!effectWouldDoSomething/);
    });

    it('puts the drink back when the hotbar has no room for the staff', () => {
        expect(drop()).toMatch(/addInventoryItem\(slot\.dropId, 1\)/);
    });

    it('asks for the weapon by id, which the scene resolves on demand', () => {
        expect(drop()).toMatch(/this\.cb\.onWeaponPickup\(egg\.weaponId\)/);
        const scene = read('src', 'game', 'scenes', 'scene.ts');
        expect(scene).toMatch(/fetchWeapon\(weaponId\)/);
        expect(scene).toMatch(/tryPickupWeaponById/);
    });
});