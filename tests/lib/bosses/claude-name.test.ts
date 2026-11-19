/**
 * tests/lib/bosses/claude-name.test.ts
 * --------------------------------------------------------------------------
 * The boss is called Claude on every rung, in both languages.
 *
 * The owner: `都改Claude，灭世·Claude / 神·Claude / 半神·Claude / 半神半人·Claude`.
 *
 * The prefixes still walk the ladder (灭世 → 神 → 半神 → 半神半人 → nothing); only the name
 * underneath them changed. It comes from the monster YAML, so the plate and the fight both
 * read the same source.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { bossPhaseTitle, BOSS_PHASE_TITLES } from '@/lib/bosses/phases';

const ROOT = process.cwd();
const yaml = () =>
    readFileSync(join(ROOT, 'public', 'data', 'monsters', 'claude.yaml'), 'utf8');

/** Just the two name lines, so a comment mentioning 克劳德 cannot pass this test. */
function declaredNames(): { name?: string; nameZh?: string } {
    const out: { name?: string; nameZh?: string } = {};
    for (const line of yaml().split(/\r?\n/)) {
        const match = /^(name|nameZh):\s*'?([^'\r\n]+)'?\s*$/.exec(line);
        if (match) out[match[1] as 'name' | 'nameZh'] = match[2].trim();
    }
    return out;
}

const BASE = declaredNames().nameZh ?? 'Claude';

describe('the data', () => {
    it('declares Claude in both name fields', () => {
        expect(declaredNames().name).toBe('Claude');
        expect(declaredNames().nameZh).toBe('Claude');
    });
});

describe('the plate', () => {
    it('reads 灭世·Claude first', () => {
        expect(bossPhaseTitle(0, BASE, 'zh')).toBe('灭世·Claude');
    });

    it('walks the ladder without ever transliterating her name', () => {
        expect(bossPhaseTitle(1, BASE, 'zh')).toBe('神·Claude');
        expect(bossPhaseTitle(2, BASE, 'zh')).toBe('半神·Claude');
        expect(bossPhaseTitle(3, BASE, 'zh')).toBe('半神半人·Claude');
    });

    it('keeps her name in the final form', () => {
        expect(bossPhaseTitle(3, BASE, 'zh')).toContain('Claude');
    });

    it('says the same thing in English', () => {
        expect(bossPhaseTitle(0, 'Claude', 'en')).toBe('World-Ender Claude');
        expect(bossPhaseTitle(3, 'Claude', 'en')).toBe('Half-Mortal Claude');
    });

    it('keeps every Chinese prefix', () => {
        expect(BOSS_PHASE_TITLES.annihilation.zh).toBe('灭世');
        expect(BOSS_PHASE_TITLES.deity.zh).toBe('神');
        expect(BOSS_PHASE_TITLES.demigod.zh).toBe('半神');
        expect(BOSS_PHASE_TITLES['half-mortal'].zh).toBe('半神半人');
    });
});