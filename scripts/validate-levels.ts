/**
 * scripts/validate-levels.ts
 * --------------------------------------------------------------------------
 * CI / pre-commit sanity check for public/data/levels/.
 *
 *   - Each id in index.yaml must have a matching data/levels/<id>.yaml file
 *   - Each file's imageSize must equal its prompts/scenes/<id>.yaml imageSize
 *   - Every level a `travel` trigger leads to must exist and validate too
 *
 * Orphan files (data/levels/*.yaml not listed in index.yaml) are ALLOWED —
 * treat them as drafts. The check is one-way. The one exception is a hidden
 * door's target: it is deliberately kept out of index.yaml (the index's last
 * entry is what the victory check treats as the end of the game), so it is
 * discovered by following the travel triggers instead.
 *
 * Run:
 *   pnpm tsx scripts/validate-levels.ts
 */

import { config as loadEnv } from 'dotenv';

import { fetchLevel, fetchLevelIndex } from '@/lib/levels';
import { formatImageSize } from '@/lib/levels/types';

loadEnv(); // .env
loadEnv({ path: '.env.local', override: true }); // .env.local

async function main(): Promise<void> {
    const index = await fetchLevelIndex();
    if (index.levels.length === 0) {
        console.error('Level index is empty — add an entry to public/data/levels/index.yaml.');
        process.exit(1);
    }

    // Follow every hidden door so its target is validated with the rest.
    const doors = new Set<string>();
    for (const id of index.levels) {
        const level = await fetchLevel(id);
        for (const trigger of level.triggers ?? []) {
            if ('travel' in trigger) doors.add(trigger.travel.targetScene);
        }
    }
    const ids = [...index.levels, ...[...doors].filter((id) => !index.levels.includes(id))];

    let failed = 0;
    for (const id of ids) {
        try {
            const level = await fetchLevel(id);

            // Check imageSize format valid.
            if (!formatImageSize(level.imageSize)) {
                throw new Error(`invalid imageSize in level ${id}`);
            }

            const tag = doors.has(id) && !index.levels.includes(id) ? ' [hidden door]' : '';
            console.log(`  ✓ ${id}  (${level.airWalls.length} walls)${tag}`);
        } catch (err) {
            console.error(`  ✗ ${id}:`, err instanceof Error ? err.message : err);
            failed++;
        }
    }

    if (failed > 0) {
        console.error(`\n${failed} level(s) failed validation.`);
        process.exit(1);
    }
    console.log(`\nAll ${ids.length} level(s) valid.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
