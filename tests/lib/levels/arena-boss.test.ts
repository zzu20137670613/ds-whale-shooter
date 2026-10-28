/**
 * tests/lib/levels/arena-boss.test.ts
 * --------------------------------------------------------------------------
 * The hidden arena's placeholder boss, checked against the shipped YAML.
 *
 * The point is the wiring, not the numbers: `boss.monsterType` has to name a
 * monster that is actually standing in the level, and that monster has to
 * exist as a spec. If any leg of that chain breaks, killing Claude does
 * nothing at all and the level simply never ends — which looks exactly like a
 * broken trigger, not like a typo in a YAML file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import { parseMonsterYaml } from '@/lib/monsters/parser';

const LEVEL = 'warhammer-redeem';
const dir = join(process.cwd(), 'public', 'data', 'levels');
const level = parseLevelYaml(readFileSync(join(dir, `${LEVEL}.yaml`), 'utf8'), LEVEL);

describe('arena boss wiring', () => {
    it('names a boss monster', () => {
        expect(level.boss?.monsterType).toBe('claude');
    });

    it('actually places that monster in the level', () => {
        const spawn = level.monsters?.find((m) => m.type === level.boss?.monsterType);
        expect(spawn).toBeDefined();
        // Centre of the ruined block, where the player walks in facing her.
        expect(spawn!.x).toBe(2752);
        expect(spawn!.y).toBe(1536);
    });

    it('ships the phase-1 numbers, armour included', () => {
        const spec = parseMonsterYaml(
            readFileSync(join(process.cwd(), 'public', 'data', 'monsters', 'claude.yaml'), 'utf8'),
            'claude',
        );
        // Owner's baseline for 灭世·Claude. Her phases scale from these
        // (神 = 150%, 半神 = 80%, 半神半人 / Claude = 50%), so the armour has to
        // travel with the HP ladder.
        expect(spec.hp).toBe(4000);
        expect(spec.armor).toBe(20);
        expect(spec.moveSpeed).toBe(7);
        // No phase logic yet: she borrows a weapon rather than carrying a skill
        // set of her own.
        expect(spec.id).toBe('claude');
    });

    it('freezes the arena behind a comic and hands over to the settlement', () => {
        // 34 pages, and a boss - the two pieces the ending depends on.
        expect(level.introComic?.pages).toBe(34);
        expect(level.boss).toBeDefined();
    });
});
