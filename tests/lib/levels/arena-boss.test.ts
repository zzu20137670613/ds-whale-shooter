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

const LEVEL = 'warhammer-redeem-1-chapel';
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
        // 7 -> 3 on the owner's call (2026-11-14, `手机实测枪火柔情，boss战太难了`). The
        // phases still scale this base (1.0 / 1.5 / 0.8 / 0.5), so this one number is the
        // whole descent's speed.
        expect(spec.moveSpeed).toBe(3);
        // No phase logic yet: she borrows a weapon rather than carrying a skill
        // set of her own.
        expect(spec.id).toBe('claude');
    });

    it('wears her own sheet, one size above the player', () => {
        const spec = parseMonsterYaml(
            readFileSync(join(process.cwd(), 'public', 'data', 'monsters', 'claude.yaml'), 'utf8'),
            'claude',
        );
        // Her art, not the playable character's: the keyed 4x4 sheet.
        expect(spec.sprite?.texture).toBe('assets/image/monsters/claude-boss.png');
        expect(spec.sprite?.grid).toEqual({ rows: 4, cols: 4 });
        // 256px frames at 0.7734 = 198px on screen: her first three forms stand one size
        // above the player's 173. Later phases shrink (see `spriteHeightForPhase`), so the
        // authored scale is only the phase-1 default.
        expect(spec.sprite?.scale).toBeCloseTo(198 / 256, 4);
        // The sheet is 1024x1024, so a 4x4 grid gives 256px frames. If someone
        // re-exports the art at another size, this catches the stale scale.
        const sheet = join(
            process.cwd(),
            'public',
            'assets',
            'image',
            'monsters',
            'claude-boss.png',
        );
        const buf = readFileSync(sheet);
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        expect(width).toBe(1024);
        expect(height).toBe(1024);
        expect(width / spec.sprite!.grid!.cols).toBe(256);
    });

    it('has a turn-in and a cast, but no hit reaction', () => {
        const spec = parseMonsterYaml(
            readFileSync(join(process.cwd(), 'public', 'data', 'monsters', 'claude.yaml'), 'utf8'),
            'claude',
        );
        const anims = spec.anims ?? {};
        // Row 2 is the turn-in, row 4 the crouch the owner reserved for her
        // wind-up. Getting shot flashes the sprite instead of playing a track.
        expect(anims.turn?.frames).toEqual([4, 7]);
        expect(anims.cast?.frames).toEqual([12, 15]);
        expect(anims.hit).toBeUndefined();
        // The stride is row 3, not the turn row.
        expect(anims.move?.frames).toEqual([8, 11]);
    });

    it('freezes the arena behind a comic and hands over to the settlement', () => {
        // 34 pages, and a boss - the two pieces the ending depends on.
        expect(level.introComic?.pages).toBe(34);
        expect(level.boss).toBeDefined();
    });
});
