/**
 * tests/lib/characters/boss-forces-whale.test.ts
 * --------------------------------------------------------------------------
 * The boss level must hand you 鲸娘, whoever you walked in as.
 *
 * The owner: `我使用gemini打boss关发现没有自动切换成deepseek，检查一下是不是判定有问题?`
 *
 * He was right, and the cause was precedence: `resolve-scene` read
 *
 *     selectedCharacterId ?? level.character ?? firstCharacter
 *
 * so a player with ANY character selected never reached the level's `character:` field. The
 * YAML looked like it forced 鲸娘 and never did. The level's word has to win on a boss map -
 * that is the whole point of the field - while the saved pick stays untouched, so walking out
 * puts the player back as themselves.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { bossCharacterId } from '@/lib/characters/boss-character';
import { parseLevelYaml } from '@/lib/levels/parser';

const ROOT = process.cwd();
const WARHAMMER = parseLevelYaml(
    readFileSync(join(ROOT, 'public', 'data', 'levels', 'warhammer-redeem-1-chapel.yaml'), 'utf8'),
    'warhammer-redeem-1-chapel',
);

describe('who walks into the boss fight', () => {
    it('is 鲸娘, even when the save says Gemini', () => {
        expect(bossCharacterId(WARHAMMER, 'gemini')).toBe('deepseek');
    });

    it('is 鲸娘 when nothing is selected at all', () => {
        expect(bossCharacterId(WARHAMMER, null)).toBe('deepseek');
    });

    it('is the saved pick on every other level', () => {
        const tavern = { ...WARHAMMER, boss: undefined, character: 'gpt' };
        expect(bossCharacterId(tavern as never, 'gemini')).toBeUndefined();
    });

    it('falls back to the saved pick when a boss level names nobody', () => {
        const unnamed = { ...WARHAMMER, character: undefined };
        expect(bossCharacterId(unnamed as never, 'gemini')).toBeUndefined();
    });
});

/** Every boss level, whichever pick the player walked in with. */
const BOSS_LEVELS = [
    'warhammer-redeem-1-chapel',
    'warhammer-redeem-2-warship',
    'warhammer-redeem-3-fireworks',
    'warhammer-redeem-4-first-meeting',
];

describe('nobody but 鲸娘 walks into a boss level', () => {
    it.each(BOSS_LEVELS)('%s hands Claude the whale girl too', (levelId) => {
        // The owner: `最后一关的 Claude 不能进 boss 关...跟 gpt、qwen、gemini 一样，
        // 进关自动变成 deepseek`。Claude is the boss on these maps, which is exactly why
        // she must not also be the player - the fight would be Claude vs Claude.
        const level = parseLevelYaml(
            readFileSync(join(ROOT, 'public', 'data', 'levels', `${levelId}.yaml`), 'utf8'),
            levelId,
        );
        expect(level.boss, 'is a boss level').toBeDefined();
        expect(bossCharacterId(level, 'claude')).toBe('deepseek');
        expect(bossCharacterId(level, 'gpt')).toBe('deepseek');
        expect(bossCharacterId(level, 'qwen')).toBe('deepseek');
        expect(bossCharacterId(level, 'gemini')).toBe('deepseek');
    });
});

describe('the level file itself', () => {
    it('names the whale girl', () => {
        expect(WARHAMMER.character).toBe('deepseek');
    });

    it('is a boss level', () => {
        expect(WARHAMMER.boss).toBeDefined();
    });
});