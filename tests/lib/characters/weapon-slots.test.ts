/**
 * tests/lib/characters/weapon-slots.test.ts
 * --------------------------------------------------------------------------
 * Four weapon slots for everyone.
 *
 * The owner: `将所有人物的武器格子都统一为4个（之前Claude是3个？）`. He was right - Claude was
 * the only character carrying an explicit `weaponMax: 3`, and every other file either said 4
 * or fell back to the shared default. A slot count that differs per character is a balance
 * decision nobody made; this pins it to one number for all five.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseCharacterYaml } from '@/lib/characters/parser';

const ROOT = process.cwd();
const CHARACTERS = ['deepseek', 'gpt', 'gemini', 'qwen', 'claude'] as const;

const load = (id: string) =>
    parseCharacterYaml(
        readFileSync(join(ROOT, 'public', 'data', 'characters', `${id}.yaml`), 'utf8'),
        id,
    );

describe('weapon slots', () => {
    for (const id of CHARACTERS) {
        it(`${id} holds four`, () => {
            expect(load(id).weaponMax).toBe(4);
        });
    }

    it('is spelled out in every file, not inherited from a default', () => {
        // An explicit number is what let Claude drift to 3 unnoticed.
        for (const id of CHARACTERS) {
            const raw = readFileSync(
                join(ROOT, 'public', 'data', 'characters', `${id}.yaml`),
                'utf8',
            );
            expect(raw).toMatch(/^weaponMax: 4$/m);
        }
    });

    it('still starts every character with their two authored weapons', () => {
        for (const id of CHARACTERS) {
            expect(load(id).hotbar.length).toBe(2);
        }
    });
});