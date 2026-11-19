/**
 * tests/lib/quips/data.test.ts
 * --------------------------------------------------------------------------
 * 台词表本身：数量、分组、只有鲸鱼娘会说、以及几件容易写错的事。
 *
 * 主人 2026-11-18：`我预想是写个十几二十句台词`，要三个方向 —— 反向安利桌宠、
 * 安利 galgame《深海回响·鲸鲸》、安利枪火柔情自己。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseQuipsYaml } from '@/lib/quips/parser';
import { QUIP_MEMORY_WINDOW } from '@/lib/quips/pool';

const ROOT = process.cwd();
const quips = parseQuipsYaml(readFileSync(join(ROOT, 'public', 'data', 'quips.yaml'), 'utf8'));

describe('the quip pool', () => {
    it('has enough lines that the memory window never has to be violated', () => {
        // 主人要"十几二十句"；顺带保证池子比记忆窗口大，不然窗口只能退让。
        expect(quips.length).toBeGreaterThanOrEqual(15);
        expect(quips.length).toBeGreaterThan(QUIP_MEMORY_WINDOW);
    });

    it('covers all three directions he asked for', () => {
        const groups = new Set(quips.map((q) => q.group));
        expect(groups.has('pet')).toBe(true);
        expect(groups.has('galgame')).toBe(true);
        expect(groups.has('shooter')).toBe(true);
    });

    it('promotes the galgame by its real name', () => {
        const galgame = quips.filter((q) => q.group === 'galgame');
        expect(galgame.length).toBeGreaterThanOrEqual(4);
        expect(galgame.some((q) => q.text.includes('深海回响·鲸鲸'))).toBe(true);
    });

    it('mentions that the galgame ships on both platforms', () => {
        const galgame = quips.filter((q) => q.group === 'galgame');
        expect(galgame.some((q) => q.text.includes('双端'))).toBe(true);
    });

    it('does not sell the galgame as a shooter', () => {
        // 那边卖的是"直连 API / 可调上下文 / 说话"，不是打枪。
        const galgame = quips.filter((q) => q.group === 'galgame');
        expect(galgame.some((q) => q.text.includes('API'))).toBe(true);
        expect(galgame.some((q) => q.text.includes('上下文'))).toBe(true);
    });

    it('has no duplicate ids and no empty text', () => {
        expect(new Set(quips.map((q) => q.id)).size).toBe(quips.length);
        for (const q of quips) expect(q.text.trim().length).toBeGreaterThan(0);
    });

    it('keeps every line short enough to read above her head', () => {
        // 头顶那句会折行（`SAY_WRAP_CHARS` = 20 字），但不能长到失控。
        // 主人 2026-11-18 亲手把几句写到 54 字（带 gitee 仓库名），所以上限放到 60。
        for (const q of quips) expect(q.text.length).toBeLessThanOrEqual(60);
    });
});