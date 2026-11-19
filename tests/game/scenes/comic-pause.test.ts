/**
 * tests/game/scenes/comic-pause.test.ts
 * --------------------------------------------------------------------------
 * The boss must not swing while the intro comic covers the canvas.
 *
 * The owner: `如果多看一会漫画的话进入boss战就直接死亡了，这不对，应该是进入boss战地图之后才开打，
 * boss不能趁玩家看漫画的时候偷袭啊`.
 *
 * Two guards, checked here by reading the source: the attack tick bails while a comic is
 * open, and damage into the player is dropped as well (bullets already in the air).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the boss during the comic', () => {
    const monsters = read('src', 'game', 'monsters', 'monster.ts');

    it('does not attack', () => {
        expect(monsters).toContain('comicIntroLevelId');
        // The flag has to reach the attack condition, not just sit in the file.
        // The guard has to sit inside the attack condition itself.
        expect(monsters).toMatch(/!comicOpen &&[\s\S]{0,400}performAttack/);
    });
});

describe('the player during the comic', () => {
    const scene = read('src', 'game', 'scenes', 'scene.ts');

    it('takes no damage', () => {
        expect(scene).toMatch(/onPlayerHit[\s\S]{0,300}comicIntroLevelId/);
    });
});

describe('the death screen', () => {
    const overlay = read('src', 'components', 'hud', 'death-overlay.tsx');

    it('shows the pavilion line at the subtitle size', () => {
        // `回到海边亭台字体太小了` - it was text-[8px] under a text-[14px] subtitle.
        const matches = overlay.match(/text-\[14px\]/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
        expect(overlay).not.toContain('text-[8px]');
    });
});

describe('the settings hint', () => {
    const overlay = read('src', 'components', 'hud', 'settings-overlay.tsx');

    it('matches the death screen subtitle size', () => {
        // `重新开始会回到海边亭台` was text-[9px] under a 13px button.
        expect(overlay).not.toContain('text-[9px] tracking-wider text-stone-500 uppercase');
        expect(overlay).toMatch(/text-\[14px\][\s\S]{0,120}settings\.restartHint/);
    });
});
