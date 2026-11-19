/**
 * tests/lib/drops/gemini-egg.test.ts
 * --------------------------------------------------------------------------
 * Gemini drinks the iced juice, likes it, and then notices what came with it.
 *
 * The owner: `当Gemini使用冰镇果汁时，自动装备一个在装备栏装备上并切换为秘法法杖，同时头顶冒出
 * 一句话：喵，果汁真好喝~~咦？这是什么喵？`
 */

import { describe, expect, it } from 'vitest';

import {
    GPT_JUICE_LINE,
    GEMINI_JUICE_LINE,
    GEMINI_JUICE_WEAPON_ID,
    JUICE_LINE,
    juiceEasterEgg,
} from '@/lib/drops/easter-eggs';

describe('the line', () => {
    it('is exactly what he wrote', () => {
        expect(GEMINI_JUICE_LINE).toBe('喵，果汁真好喝~~咦？这是什么喵？');
    });

    it('everyone else says the short version', () => {
        expect(JUICE_LINE).toBe('冰镇果汁，好喝！');
    });

    it('equips the arcane staff by its real weapon id', () => {
        expect(GEMINI_JUICE_WEAPON_ID).toBe('arcana-staff');
    });
});

describe('when it fires', () => {
    it('on Gemini drinking iced juice', () => {
        expect(juiceEasterEgg('gemini', 'iced-juice')).toEqual({
            weaponId: GEMINI_JUICE_WEAPON_ID,
            line: GEMINI_JUICE_LINE,
        });
    });

    it('GPT gets the staff too, with 嗷 instead of 喵', () => {
        const egg = juiceEasterEgg('gpt', 'iced-juice');
        expect(egg?.weaponId).toBe(GEMINI_JUICE_WEAPON_ID);
        expect(egg?.line).toBe(GPT_JUICE_LINE);
        expect(egg?.line).not.toContain('喵');
    });

    it('every other character gets a line, and no staff', () => {
        for (const id of ['deepseek', 'qwen', 'claude']) {
            const egg = juiceEasterEgg(id, 'iced-juice');
            expect(egg?.line).toBe(JUICE_LINE);
            expect(egg?.weaponId).toBeUndefined();
        }
    });

    it('an unknown character still gets the generic line', () => {
        expect(juiceEasterEgg(null, 'iced-juice')?.line).toBe(JUICE_LINE);
    });

    it('not for any other drink - the egg belongs to the juice', () => {
        for (const drop of ['hp-shard', 'ammo-box', 'material-iron']) {
            expect(juiceEasterEgg('gemini', drop)).toBeNull();
            expect(juiceEasterEgg('qwen', drop)).toBeNull();
        }
    });
});

describe('the line on screen', () => {
    // 这两条原来检查头顶那句的字号与高度。2026-11-18 主人要求所有台词`一起收`进
    // 那条带边框的提示，头顶那条通道（`say.ts`）整体删掉了 —— 字号现在只有一处
    // （`NOTICE_FONT_PX`），见 `tests/components/hud/notice-*.test.*`。
});
