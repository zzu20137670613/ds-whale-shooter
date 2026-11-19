/**
 * tests/lib/nickname/pool.test.ts
 * --------------------------------------------------------------------------
 * The nickname pool and the cross-game key.
 *
 * Pool + roll are copied from the galgame (第七世, 2026-11-01), and the key is the one the
 * galgame hands out when a run is sealed (`deepseek1314`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    HIDDEN_MAP_KEY,
    NICKNAME_MAX_LENGTH,
    RANDOM_NAME_POOL,
    isHiddenMapKey,
    normaliseNickname,
    resolveNicknameSubmission,
    rollRandomName,
} from '@/lib/nickname/pool';

describe('the pool', () => {
    it("is the galgame's eighteen words", () => {
        expect(RANDOM_NAME_POOL).toHaveLength(18);
        expect(RANDOM_NAME_POOL[0]).toBe('潮生');
        expect(RANDOM_NAME_POOL[17]).toBe('慕鲸');
    });

    it('rolls inside the pool', () => {
        for (let i = 0; i < 200; i += 1) {
            expect(RANDOM_NAME_POOL).toContain(rollRandomName());
        }
    });

    it('is deterministic when the random source is', () => {
        expect(rollRandomName(() => 0)).toBe('潮生');
        expect(rollRandomName(() => 0.999)).toBe('慕鲸');
        expect(rollRandomName(() => 1)).toBe('慕鲸'); // clamped, never undefined
    });

    it('allows repeats - it is an easter egg, not a gacha', () => {
        const rolls = Array.from({ length: 5 }, () => rollRandomName(() => 0));
        expect(new Set(rolls).size).toBe(1);
    });
});

describe('the key', () => {
    it('is the one from the galgame', () => {
        expect(HIDDEN_MAP_KEY).toBe('deepseek1314');
    });

    it('ignores case and surrounding spaces', () => {
        for (const raw of ['deepseek1314', ' DeepSeek1314 ', 'DEEPSEEK1314', '\tdeepseek1314\n']) {
            expect(isHiddenMapKey(raw)).toBe(true);
        }
    });

    it('does not fire on anything else', () => {
        for (const raw of ['deepseek131', 'deepseek13140', '潮生', '']) {
            expect(isHiddenMapKey(raw)).toBe(false);
        }
    });
});

describe('submitting a name', () => {
    it('accepts a normal name', () => {
        expect(resolveNicknameSubmission('  小王  ')).toEqual({
            kind: 'accepted',
            nickname: '小王',
        });
    });

    it('never lets the key become the nickname', () => {
        // `它会为你和鲸鲸打开一张本不存在的隐藏地图` - and then asks for a real name.
        expect(resolveNicknameSubmission('deepseek1314')).toEqual({
            kind: 'unlocked',
            nickname: null,
        });
    });

    it('rejects whitespace', () => {
        expect(resolveNicknameSubmission('   ')).toEqual({
            kind: 'rejected',
            reason: 'empty',
        });
    });

    it('clamps a very long name', () => {
        const long = 'a'.repeat(50);
        expect(normaliseNickname(long)).toHaveLength(NICKNAME_MAX_LENGTH);
    });
});

describe('the dialog wiring', () => {
    it('opens right after the character is confirmed', () => {
        const source = readFileSync(
            join(process.cwd(), 'src', 'game', 'scenes', 'tavern-controller.ts'),
            'utf8',
        );
        expect(source).toMatch(
            /setSelectedCharacterId\(spec\.id\)[\s\S]{0,240}openNicknamePrompt/,
        );
    });

    it('survives a save so the hidden entrance stays unlocked', () => {
        const store = readFileSync(
            join(process.cwd(), 'src', 'store', 'game-store.ts'),
            'utf8',
        );
        expect(store).toMatch(/hiddenMapUnlocked: state\.hiddenMapUnlocked/);
        expect(store).toMatch(/playerNickname: state\.playerNickname/);
    });
});

describe('the hidden entrance', () => {
    const tavern = () =>
        readFileSync(join(process.cwd(), 'public', 'data', 'levels', 'tavern.yaml'), 'utf8');

    it('is gated on the key, not on the level being cleared', () => {
        const yaml = tavern();
        expect(yaml).toMatch(/id: hidden-whale-entrance[\s\S]{0,220}hiddenUnlessUnlocked: true/);
        expect(yaml).toMatch(/id: hidden-whale-entrance[\s\S]{0,260}requiresClear: false/);
    });

    it('is the same size as the beach portal', () => {
        const yaml = tavern();
        const exit = /id: tavern-exit[\s\S]{0,400}?radius: (\d+)/.exec(yaml);
        const hidden = /id: hidden-whale-entrance[\s\S]{0,320}?radius: (\d+)/.exec(yaml);
        expect(exit?.[1]).toBe('60');
        expect(hidden?.[1]).toBe(exit?.[1]);
    });

    it('leads to a level that exists', () => {
        expect(tavern()).toContain('targetScene: hidden-whale');
        expect(() =>
            readFileSync(join(process.cwd(), 'public', 'data', 'levels', 'hidden-whale.yaml')),
        ).not.toThrow();
    });
});

describe('the dialog itself', () => {
    const dialog = () =>
        readFileSync(
            join(process.cwd(), 'src', 'components', 'hud', 'nickname-dialog.tsx'),
            'utf8',
        );

    it('never prints the key on screen', () => {
        // `galgame 封档密钥：deepseek1314 ！！！你怎么直接给写上去了啊喂`
        expect(dialog()).not.toContain('HIDDEN_MAP_KEY');
        expect(dialog()).not.toContain('nickname.footer');
        expect(dialog()).not.toContain('deepseek1314');
    });

    it('frees the keyboard while it is open, or typing does nothing', () => {
        expect(dialog()).toContain("EventBus.emit('ui-typing', true)");
        expect(dialog()).toContain("EventBus.emit('ui-typing', false)");
        expect(dialog()).toContain('autoFocus');
    });

    it('and the scene honours that flag', () => {
        const scene = readFileSync(
            join(process.cwd(), 'src', 'game', 'scenes', 'scene.ts'),
            'utf8',
        );
        expect(scene).toMatch(/typingListener = \(typing: boolean\)[\s\S]{0,200}keyboard\.enabled = !typing/);
    });
});
