/**
 * tests/lib/levels/guardian-waves.test.ts
 * --------------------------------------------------------------------------
 * The three guardian bosses and the last wave they belong to.
 *
 * Owner, 2026-11-12: Kitty guards the library, Bunny the sky city, Wanderer
 * Atlantis - each with exactly ONE of 半神·Claude's attacks, and each dropped
 * item written straight into the third (last) wave.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDropIndex, parseDropYaml } from '@/lib/drops/parser';
import { parseLevelYaml } from '@/lib/levels/parser';
import { parseMonsterYaml } from '@/lib/monsters/parser';
import { waveComposition } from '@/lib/monsters/region';

const DATA = join(process.cwd(), 'public', 'data');

function raw(path: string): string {
    return readFileSync(join(DATA, path), 'utf8');
}

function loadLevel(id: string) {
    return parseLevelYaml(raw(`levels/${id}.yaml`), id);
}

function loadMonster(id: string) {
    return parseMonsterYaml(raw(`monsters/${id}.yaml`), id);
}

function loadDrop(id: string) {
    return parseDropYaml(raw(`drops/${id}.yaml`), id);
}

const GUARDIANS = {
    kitty: { attack: 'triple-cannon', ammo: 2, shards: 2 },
    bunny: { attack: 'barrage', ammo: 3, shards: 3 },
    // 主人 2026-11-12：Wanderer 改三连击 + 天谴轰炸。
    wanderer: { attack: 'triple-wrath', ammo: 5, shards: 0 },
} as const;

/** How many copies one drop entry asks for: base 1 plus each stacked chance. */
function copies(entry: any): number {
    let count = 1;
    for (const key of ['chance2', 'chance3']) {
        if (typeof entry[key] === 'number' && entry[key] > 0) count += 1;
    }
    return count;
}

function dropCounts(spec: { drops?: readonly any[] }): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of spec.drops ?? []) {
        counts[entry.dropId] = (counts[entry.dropId] ?? 0) + copies(entry);
    }
    return counts;
}

describe('the three guardians', () => {
    for (const [id, want] of Object.entries(GUARDIANS)) {
        it(`${id} borrows one 半神 attack and nothing else`, () => {
            const spec = loadMonster(id);
            expect(spec.bossAttack).toBe(want.attack);
            // 半神（第 3 阶段）的倍率，主人：`伤害复用半神Claude的伤害`。
            expect(spec.bossAttackDamageScale).toBe(0.8);
            // No weapon of their own: the pattern above IS the attack.
            expect(spec.weaponId).toBe('physical-salvation-boss');
        });

        it(`${id} drops a token shield plus the owner's count`, () => {
            const counts = dropCounts(loadMonster(id));
            expect(counts['token-shield']).toBe(1);
            expect(counts['ammo-cache']).toBe(want.ammo);
            // 主人 2026-11-17：`直接更换，不掉生命碎片，掉灵力碎片`
            // —— 守护者原来掉生命碎片，现在改掉灵力碎片，档位数不变。
            expect(counts['sp-fragment'] ?? 0).toBe(want.shards);
            expect(counts['hp-shard'] ?? 0).toBe(0);
        });

        it(`${id} is drawn from a 4x4 sheet`, () => {
            const spec = loadMonster(id);
            expect(spec.sprite?.grid).toEqual({ rows: 4, cols: 4 });
            expect(spec.sprite?.texture).toBe(`assets/image/monsters/${id}.png`);
        });
    }
});

describe('the last wave of each map', () => {
    const cases: { level: string; far: string[] }[] = [
        {
            level: 'starry-library-4-scroll',
            far: ['keeper', 'sniper', 'keeper', 'sniper', 'kitty'],
        },
        {
            level: 'gpt-sky-city-4-throne-hall',
            far: ['warden', 'drone-ultra', 'warden', 'drone-ultra', 'bunny'],
        },
        {
            level: 'dsh-atlantis-4-coronation-dais',
            far: ['warden', 'bengbu-erba', 'warden', 'bengbu-erba', 'wanderer'],
        },
    ];

    for (const { level, far } of cases) {
        it(`${level} names its far ring and keeps the near ring`, () => {
            const parsed = loadLevel(level);
            expect(parsed.spawner?.finalWave?.far).toEqual(far);
        });
    }

    it('turns the named far ring into slots, guardians included', () => {
        const slots = waveComposition({
            far: ['warden', 'bengbu-erba', 'warden', 'bengbu-erba', 'wanderer'],
        });
        const near = slots.filter((slot) => slot.distance === 'near');
        const farSlots = slots.filter((slot) => slot.distance === 'far');
        // Near ring is untouched: the fixed 2 melee + 2 ranged.
        expect(near).toHaveLength(4);
        expect(farSlots).toHaveLength(5);
        expect(farSlots[4]!.monsterId).toBe('wanderer');
    });

    it('keeps the old shape when a level names nothing', () => {
        expect(waveComposition()).toHaveLength(9);
        expect(waveComposition().some((slot) => slot.monsterId !== undefined)).toBe(false);
    });
});

describe('the token shield pickup', () => {
    it('is a token-shield effect drawn with its own 64px drop icon', () => {
        const drop = loadDrop('token-shield');
        expect(drop.effect.type).toBe('token-shield');
        // 掉落用自己的 64x64 单帧（掉落贴图统一按 64 的格子切）；
        // 武器那张 rune-shield.png 是钢铁典狱长手里的盾，尺寸不同，不能共用。
        expect(drop.sprite?.texture).toBe('assets/image/drops/token-shield.png');
        expect(drop.nameZh).toBe('词元盾');
    });

    it('is registered in the drop index', () => {
        const index = parseDropIndex(raw('drops/index.yaml'));
        expect(index.drops).toContain('token-shield');
    });
});