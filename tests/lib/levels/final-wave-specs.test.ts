/**
 * tests/lib/levels/final-wave-specs.test.ts
 * --------------------------------------------------------------------------
 * The final wave names monsters from OUTSIDE the level's pool (the three guardian
 * bosses), and every one of them has to be prefetched.
 *
 * The owner: `图书馆卷轴关卡，我们约定的第三波（最后一波怪物）的 boss 和两个云海德鲁伊
 * 没有出现（怀疑天空之城和亚特兰蒂斯的最后一关会有相同问题）`。
 *
 * Cause: `collectMonsterIds` read `monsters[]`, `spawner.pool` and `boss` — not
 * `spawner.finalWave`. `spawnOne` then found no spec for `kitty` / `keeper` and returned
 * silently, while the wave still counted as fired. Same class of bug as the one that once
 * made all three worlds spawn nothing at all.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseLevelYaml } from '@/lib/levels/parser';
import { collectMonsterIds } from '@/lib/levels/prefetch';

const ROOT = process.cwd();
const load = (id: string) =>
    parseLevelYaml(readFileSync(join(ROOT, 'public', 'data', 'levels', `${id}.yaml`), 'utf8'), id);

const FINAL_LEVELS = [
    'starry-library-4-scroll',
    'gpt-sky-city-4-throne-hall',
    'dsh-atlantis-4-coronation-dais',
];

describe.each(FINAL_LEVELS)('%s', (levelId) => {
    const level = load(levelId);
    const far = level.spawner?.finalWave?.far ?? [];
    const prefetched = collectMonsterIds(level);

    it('authored a final wave at all', () => {
        expect(far.length).toBeGreaterThan(0);
    });

    it('prefetches every monster the final wave names', () => {
        for (const id of far) {
            expect(prefetched, `${id} missing from the spec map`).toContain(id);
        }
    });

    it('still prefetches its ordinary pool', () => {
        for (const id of [...(level.spawner?.pool.melee ?? []), ...(level.spawner?.pool.ranged ?? [])]) {
            expect(prefetched).toContain(id);
        }
    });
});

describe('the guardians the owner actually reported', () => {
    it('library scroll prefetches the two druids and Kitty', () => {
        // `第三波的 boss 和两个云海德鲁伊没有出现` - keeper x2 + kitty, in that order.
        const ids = collectMonsterIds(load('starry-library-4-scroll'));
        expect(ids).toContain('keeper');
        expect(ids).toContain('kitty');
    });

    it('sky city and Atlantis prefetch theirs too', () => {
        expect(collectMonsterIds(load('gpt-sky-city-4-throne-hall'))).toContain('bunny');
        expect(collectMonsterIds(load('dsh-atlantis-4-coronation-dais'))).toContain('wanderer');
        // Atlantis swaps two warden rows in, which the pool happens to cover already.
        expect(collectMonsterIds(load('dsh-atlantis-4-coronation-dais'))).toContain('bengbu-erba');
    });

    it('keeps hand-placed rows and the boss on the list', () => {
        const chapel = load('warhammer-redeem-1-chapel');
        const ids = collectMonsterIds(chapel);
        expect(ids).toContain('claude'); // boss
    });
});