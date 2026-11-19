// @vitest-environment happy-dom
/**
 * tests/lib/pet/mobile-blessing.test.ts
 * --------------------------------------------------------------------------
 * On a phone there is no desktop pet, so the blessing is a fixed 20% - for DeepSeek only.
 *
 * The owner: `移动端没有桌宠联动，把鲸鱼娘本人游玩的buff做成死值，选择deepseek做游戏人物的话自动锁定
 * 这个buff，数值的话设为20%，其他人物没有这个buff`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    MOBILE_BLESSING_PERCENT,
    mobileBlessing,
    PET_BONUS_CHARACTER_ID,
    petBonusAppliesTo,
} from '@/lib/pet/bonus';

const ROOT = process.cwd();
const app = () => readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');

describe('the pinned value', () => {
    it('is 20 percent', () => {
        expect(MOBILE_BLESSING_PERCENT).toBe(20);
    });

    it('is handed to DeepSeek on the mobile build', () => {
        const bonus = mobileBlessing(true, true);
        expect(bonus?.percent).toBe(20);
        // `fallback` is the pet module's word for "no live session", which is exactly the
        // mobile case: nothing is running, the number is simply true.
        expect(bonus?.source).toBe('fallback');
        expect(bonus?.suspended).toBe(false);
    });

    it('is withheld from every other character', () => {
        expect(mobileBlessing(true, false)).toBeNull();
        expect(petBonusAppliesTo('qwen')).toBe(false);
        expect(petBonusAppliesTo('gpt')).toBe(false);
        expect(petBonusAppliesTo(PET_BONUS_CHARACTER_ID)).toBe(true);
    });

    it('does not touch the desktop build at all', () => {
        expect(mobileBlessing(false, true)).toBeNull();
    });
});

describe('the boot path', () => {
    it('pins the blessing on mobile and puts the bridge away', () => {
        const source = app();
        expect(source).toContain('mobileBlessing(mobile');
        // The bridge must not run on a phone: there is no pet to talk to, and the request
        // would only fail into the console.
        expect(source).toMatch(/if \(!mobile\) void startPetBridge\(deps\)/);
    });

    it('still starts the bridge on desktop', () => {
        expect(app()).toContain('startPetBridge');
        expect(app()).toContain('installPetExitHooks(deps)');
    });
});