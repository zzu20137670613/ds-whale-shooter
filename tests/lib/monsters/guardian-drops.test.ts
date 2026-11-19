/**
 * tests/lib/monsters/guardian-drops.test.ts
 * --------------------------------------------------------------------------
 * Every drop a guardian's table names must exist, parse, and be loadable.
 *
 * The owner: `另外没有掉落词元盾` (Kitty died and no Token Shield appeared). The death
 * handler resolves each drop id through the level's prefetched spec map and THROWS on an
 * unknown id, so a single bad reference kills the whole roll - including the ammo and HP
 * shards next to it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDropYaml } from '@/lib/drops/parser';
import { parseMonsterYaml } from '@/lib/monsters/parser';

const ROOT = process.cwd();
const monster = (id: string) =>
    parseMonsterYaml(readFileSync(join(ROOT, 'public', 'data', 'monsters', `${id}.yaml`), 'utf8'), id);
const drop = (id: string) =>
    parseDropYaml(readFileSync(join(ROOT, 'public', 'data', 'drops', `${id}.yaml`), 'utf8'), id);

const GUARDIANS = ['kitty', 'bunny', 'wanderer'];

describe.each(GUARDIANS)('%s drop table', (id) => {
    const spec = monster(id);

    it('names at least one drop', () => {
        expect(spec.drops.length).toBeGreaterThan(0);
    });

    it('resolves every drop id to a spec that parses', () => {
        for (const ref of spec.drops) {
            expect(() => drop(ref.dropId), `${ref.dropId} does not parse`).not.toThrow();
        }
    });
});

describe('the Token Shield itself', () => {
    const spec = drop('token-shield');

    it('is a pickup-on-touch effect, not an inventory item', () => {
        expect(spec.effect.type).toBe('token-shield');
        expect(spec.kind).toBe('static');
    });

    it('has a sprite the game can draw', () => {
        expect(spec.sprite?.texture).toBeTruthy();
        // 掉落用自己的 64x64 单帧，武器那张 rune-shield.png 是钢铁典狱长手里的盾（88x84）。
        expect(spec.sprite?.texture).toContain('drops/token-shield');
    });

    it('is listed in the drop index, so the loader can find it', () => {
        const index = readFileSync(join(ROOT, 'public', 'data', 'drops', 'index.yaml'), 'utf8');
        expect(index).toContain('token-shield');
    });

    it('is 100% on all three guardians', () => {
        for (const id of GUARDIANS) {
            const ref = monster(id).drops.find((d) => d.dropId === 'token-shield');
            expect(ref, `${id} does not drop Token Shield`).toBeDefined();
            expect(ref!.chance).toBe(1);
        }
    });
});