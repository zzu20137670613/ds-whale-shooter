/**
 * src/lib/drops/catalog.ts
 * --------------------------------------------------------------------------
 * The bag's name/price/art lookup.
 *
 * It used to be rebuilt from scratch for every scene, from that scene's drop ids only.
 * The bag itself is global, so a drink picked up on the beach and still in the bag when
 * you walked somewhere else became an item with no name and no art - the owner's
 * "目录缺失: iced-juice", rendered as a red id in an otherwise empty cell.
 *
 * The catalog is therefore accumulated, not replaced. Entries are global game data
 * (name, sell price, sprite), so keeping one from a previous scene can never be wrong.
 */

import type { DropCatalogEntry } from '@/store/game-store';

/**
 * Merge freshly resolved entries into the existing catalog.
 *
 * New data wins for ids it knows: a YAML edit to a name or price should take effect
 * without requiring a full reload.
 */
export function mergeDropCatalog(
    current: Record<string, DropCatalogEntry>,
    incoming: Record<string, DropCatalogEntry>,
): Record<string, DropCatalogEntry> {
    return { ...current, ...incoming };
}