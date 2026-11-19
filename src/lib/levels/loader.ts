/**
 * src/lib/levels/loader.ts
 * --------------------------------------------------------------------------
 * Async fetch wrappers around the pure parser. Uses `handle-fetch` so the
 * same `/data/*` paths work in browser and Node without branching.
 */

import { clearFetchCache, fetch } from '@/lib/handle-fetch';

import { parseLevelIndex, parseLevelYaml } from './parser';
import type { Level, LevelIndex } from './types';

const BASE = '/data/levels';

/**
 * Level ids that stopped existing when the painted worlds were split 4x4 -> 2x2
 * (2026-11-11). A save from before the split still names the old plate, and the fetch
 * would 404 on it - so the retired id redirects to the tile that replaced it.
 *
 * Only add an entry when a file is actually deleted; the four library tiles all have
 * their own ids and need nothing here.
 */
export const LEGACY_LEVEL_IDS: Readonly<Record<string, string>> = {
    'starry-library': 'starry-library-1-entrance',
};

/** Follow one hop of `LEGACY_LEVEL_IDS`, or return the id untouched. */
export function resolveLevelId(id: string): string {
    return LEGACY_LEVEL_IDS[id] ?? id;
}

export async function fetchLevel(id: string): Promise<Level> {
    const resolved = resolveLevelId(id);
    const text = await (await fetch(`${BASE}/${resolved}.yaml`)).text();
    return parseLevelYaml(text, resolved);
}

export async function fetchLevelIndex(forceRefresh = false): Promise<LevelIndex> {
    if (forceRefresh) {
        clearFetchCache(`${BASE}/index.yaml`);
    }
    const text = await (await fetch(`${BASE}/index.yaml`)).text();
    return parseLevelIndex(text);
}

export function clearLevelIndexCache(): void {
    clearFetchCache(`${BASE}/index.yaml`);
}
