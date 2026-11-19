/**
 * tests/lib/drops/name-width.test.ts
 * --------------------------------------------------------------------------
 * Item names are at most FOUR characters.
 *
 * The owner: `让四个字的道具名字显示全（以后的道具加一个名字的宽度上限4个字）`. The bag cell is
 * 56 px wide and the label is 11 px, so four characters fit exactly and a fifth would clip.
 * This test is the ceiling that keeps the art and the layout in step - it is cheaper to name
 * a drop 冰镇果汁 than to widen every cell again.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIR = join(process.cwd(), 'public', 'data', 'drops');
const MAX_CHARS = 4;

/**
 * 名字超四个字的例外：未至之境那把钥匙。
 *
 * 主人点名要的写法是 `deepseek的大白饭饭盆`，不是随手起的名字——它和"白米饭"那条线索
 * 是同一件东西，四个字装不下。背包格子会截断显示，但完整名字要留在数据里。
 */
const EXEMPT = new Set(['rice-bowl-basin']);

interface Row {
    id: string;
    nameZh: string;
}

const rows: Row[] = readdirSync(DIR)
    .filter((file) => file.endsWith('.yaml') && file !== 'index.yaml')
    .map((file) => {
        const text = readFileSync(join(DIR, file), 'utf8');
        const nameZh = /^nameZh:\s*"?([^"\n]+)"?/m.exec(text)?.[1]?.trim() ?? '';
        return { id: file.replace(/\.yaml$/, ''), nameZh };
    });

describe('every drop name fits one bag cell', () => {
    it('has a Chinese name', () => {
        for (const row of rows) expect(row.nameZh, row.id).not.toBe('');
    });

    it(`is at most ${MAX_CHARS} characters long`, () => {
        const tooLong = rows
            .filter((row) => [...row.nameZh].length > MAX_CHARS && !EXEMPT.has(row.id))
            .map((row) => `${row.id}: ${row.nameZh} (${[...row.nameZh].length})`);
        expect(tooLong).toEqual([]);
    });

    it('covers the drops that are actually in the game', () => {
        // A guard against the directory being emptied and this file passing vacuously.
        expect(rows.length).toBeGreaterThanOrEqual(5);
    });
});