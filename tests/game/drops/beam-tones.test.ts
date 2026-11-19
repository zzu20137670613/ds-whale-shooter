/**
 * tests/game/drops/beam-tones.test.ts
 * --------------------------------------------------------------------------
 * 主人 2026-11-14 的分工：`金色光柱配给词元盾，紫色光柱配给白龙獠牙（天空城踩龙王王座给的枪上
 * 加这个特效）白色光柱留着，给我们未至之境的道具预备着`。
 *
 * 光柱颜色从"关卡的深浅"搬到了"物品自己身上"，所以测试盯两件事：物品的 YAML 里确实写了颜色，
 * 以及 `beamToneFor` 的优先级（物品 > 武器 > 词元盾的老规矩 > 不画）。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDropYaml } from '@/lib/drops/parser';
import { parseWeaponYaml } from '@/lib/weapons/parser';
import { beamPalette, beamToneFor, beamTint, BEAM_TONES } from '@/game/drops/token-beam';
import { TOKEN_PILLAR_PALETTES } from '@/lib/constants';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, 'public', 'data', p), 'utf8');

describe('the shipped colours', () => {
    it('marks the token shield gold', () => {
        expect(parseDropYaml(read('drops/token-shield.yaml'), 'token-shield').beam).toBe('gold');
    });

    it('marks the white dragon fangs violet', () => {
        expect(parseWeaponYaml(read('weapons/white-dragon-fangs.yaml'), 'white-dragon-fangs').beam).toBe(
            'violet',
        );
    });

    it('keeps a third colour free for 未至之境', () => {
        expect(BEAM_TONES).toEqual(['gold', 'violet', 'bright']);
        // 白的那一道现在没人用 —— 是留给未至之境道具的位置，别顺手删掉。
        expect(beamTint('bright')).toBe(TOKEN_PILLAR_PALETTES.bright.fill);
    });
});

describe('beamToneFor', () => {
    it('lets the item win over the level', () => {
        expect(beamToneFor('gold', undefined, 'bright', true)).toBe('gold');
        expect(beamToneFor(undefined, 'violet', 'gold', false)).toBe('violet');
    });

    it('draws nothing for an ordinary drop', () => {
        expect(beamToneFor(undefined, undefined, 'gold', false)).toBeNull();
    });

    it('keeps the old level-tone rule for a shield that declares nothing', () => {
        // 老数据兼容：词元盾没写 beam 时按关卡深浅来。
        expect(beamToneFor(undefined, undefined, 'gold', true)).toBe('gold');
        expect(beamToneFor(undefined, undefined, 'dark', true)).toBe('violet');
        expect(beamToneFor(undefined, undefined, 'bright', true)).toBe('bright');
        expect(beamToneFor(undefined, undefined, undefined, true)).toBe('bright');
    });
});

describe('the three palettes are actually different', () => {
    it('gives each tone its own colour', () => {
        const fills = BEAM_TONES.map((t) => beamPalette(t).fill);
        expect(new Set(fills).size).toBe(3);
        expect(beamPalette('gold').fill).toBe(TOKEN_PILLAR_PALETTES.gold.fill);
        expect(beamPalette('violet').fill).toBe(TOKEN_PILLAR_PALETTES.dark.fill);
    });
});