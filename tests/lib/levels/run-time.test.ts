/**
 * tests/lib/levels/run-time.test.ts
 * --------------------------------------------------------------------------
 * 「通关用时」= 整章四张图加起来。
 *
 * 主人 2026-11-16：`关于boss关结束的通关时间，判定方式有问题，还是沿用的以前一个大图的判定时间，
 * 我们现在拆成了4个图，发现判定逻辑自动挪到了最后一个图，不准确了` —— 选项里选了「四关加起来」。
 *
 * 所以这两件事必须成立：
 *   · levelId 能分回它的 chapter；
 *   · 求和只算同一章，坏值不许变成 NaN。
 */

import { describe, expect, it } from 'vitest';

import { chapterRunMs, levelChapter } from '@/lib/levels/run-time';

describe('levelChapter', () => {
    it('strips the block number and the block name', () => {
        expect(levelChapter('warhammer-redeem-1-chapel')).toBe('warhammer-redeem');
        expect(levelChapter('warhammer-redeem-4-first-meeting')).toBe('warhammer-redeem');
        expect(levelChapter('dsh-atlantis-3-ruined-palace')).toBe('dsh-atlantis');
    });

    it('leaves a single-block level alone', () => {
        expect(levelChapter('beach-holiday')).toBe('beach-holiday');
        expect(levelChapter('tavern')).toBe('tavern');
        expect(levelChapter('dev-cabin')).toBe('dev-cabin');
    });
});

describe('chapterRunMs', () => {
    const times = {
        'warhammer-redeem-1-chapel': 600_000,
        'warhammer-redeem-2-warship': 900_000,
        'warhammer-redeem-3-fireworks': 750_000,
        'warhammer-redeem-4-first-meeting': 1_050_000,
        // 另一章的数字不许串进来
        'dsh-atlantis-1-entrance': 5_000_000,
    };

    it('adds all four blocks of the chapter', () => {
        // 10 分 + 15 分 + 12.5 分 + 17.5 分 = 55 分
        expect(chapterRunMs(times, 'warhammer-redeem-4-first-meeting')).toBe(3_300_000);
    });

    it('reports the chapter total from any block of the chapter', () => {
        expect(chapterRunMs(times, 'warhammer-redeem-1-chapel')).toBe(
            chapterRunMs(times, 'warhammer-redeem-4-first-meeting'),
        );
    });

    it('sums what exists when an earlier block was never recorded', () => {
        // 读档直打第四关：前三关没有记录，也不该报错，只算有的那几张。
        expect(chapterRunMs({ 'warhammer-redeem-4-first-meeting': 1_000 }, 'warhammer-redeem-4-first-meeting')).toBe(
            1_000,
        );
    });

    it('ignores junk instead of printing NaN', () => {
        const dirty = {
            'warhammer-redeem-1-chapel': Number.NaN,
            'warhammer-redeem-2-warship': -50,
            'warhammer-redeem-3-fireworks': 700,
        };
        expect(chapterRunMs(dirty, 'warhammer-redeem-3-fireworks')).toBe(700);
    });

    it('is zero on an empty record', () => {
        expect(chapterRunMs({}, 'warhammer-redeem-4-first-meeting')).toBe(0);
    });
});