/**
 * tests/lib/constants/token-pillar.test.ts
 * --------------------------------------------------------------------------
 * 词元盾光柱的深浅配色。
 *
 * 主人 2026-11-12：`图书馆和亚特的最后一关背景都偏暗，符文盾亮色关注没问题，天空之城背景偏亮，
 * 需要把天空之城掉落的符文盾光柱变深色光柱`。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TOKEN_PILLAR_PALETTES, tokenPillarPalette } from '@/lib/constants';
import { parseLevelYaml } from '@/lib/levels/parser';

describe('token pillar palettes', () => {
    it('defaults to the bright column for dark maps', () => {
        expect(tokenPillarPalette(undefined)).toEqual(TOKEN_PILLAR_PALETTES.bright);
        expect(tokenPillarPalette('bright')).toEqual(TOKEN_PILLAR_PALETTES.bright);
    });

    it('gives the bright plates a purple column that draws without additive blending', () => {
        // 主人 2026-11-12：`将深色光柱都改成紫色`。
        const dark = tokenPillarPalette('dark');
        expect(dark.useAdditive).toBe(false);
        const r = (dark.fill >> 16) & 0xff;
        const g = (dark.fill >> 8) & 0xff;
        const b = dark.fill & 0xff;
        // Purple: blue is the tallest channel, red the middle, green the shortest.
        expect(b).toBeGreaterThan(r);
        expect(r).toBeGreaterThan(g);
        expect(g).toBeLessThan(140);
    });

    it('offers a gold column for the cold plates', () => {
        // 主人 2026-11-12：`图书馆和亚特兰蒂斯的词元盾光柱都改成深金色`。
        // 主人 2026-11-15 推翻了这个「深」：`明明你之前给我的图是金色的，实际怎么变成了橙色`。
        // 深金乘在近白贴图上就是橙，所以现在要的是**亮金**：红绿都高、蓝很低，核心发白。
        const gold = tokenPillarPalette('gold');
        expect(gold.useAdditive).toBe(false);
        const r = (gold.fill >> 16) & 0xff;
        const g = (gold.fill >> 8) & 0xff;
        const b = gold.fill & 0xff;
        // Bright gold: red tallest, green close behind it, blue the shortest by far.
        expect(r).toBeGreaterThan(200);
        expect(r).toBeGreaterThan(g);
        expect(g).toBeGreaterThan(180);
        expect(g).toBeGreaterThan(b);
        expect(b).toBeLessThan(110);
    });

    it('keeps the bright column additive and light', () => {
        const bright = tokenPillarPalette('bright');
        expect(bright.useAdditive).toBe(true);
        expect((bright.fill >> 16) & 0xff).toBeGreaterThan(200);
        expect((bright.fill >> 8) & 0xff).toBeGreaterThan(200);
    });

    it('is opaque enough on both to see the shield at a glance', () => {
        expect(tokenPillarPalette('bright').fillAlpha).toBeGreaterThan(0.2);
        expect(tokenPillarPalette('dark').fillAlpha).toBeGreaterThan(0.4);
    });
});
/** What each world's levels actually author. */
const toneOf = (id: string) =>
    parseLevelYaml(
        readFileSync(join(process.cwd(), 'public', 'data', 'levels', `${id}.yaml`), 'utf8'),
        id,
    ).tokenPillarTone;

describe('which maps ask for which column', () => {
    it('the bright plates of the sky city use the dark column', () => {
        for (const id of [
            'gpt-sky-city-1-entrance',
            'gpt-sky-city-2-moon-bridge',
            'gpt-sky-city-3-great-tome',
            'gpt-sky-city-4-throne-hall',
        ]) {
            expect(toneOf(id), id).toBe('dark');
        }
    });

    it('Atlantis and the library use the deep gold column', () => {
        // 主人 2026-11-12：`将图书馆和亚特兰蒂斯的词元盾光柱都改成深金色`。
        for (const id of [
            'dsh-atlantis-1-entrance',
            'dsh-atlantis-2-sunken-ship',
            'dsh-atlantis-3-ruined-palace',
            'dsh-atlantis-4-coronation-dais',
            'starry-library-1-entrance',
            'starry-library-2-counter',
            'starry-library-3-terrace',
            'starry-library-4-scroll',
        ]) {
            expect(toneOf(id), id).toBe('gold');
        }
    });


});
