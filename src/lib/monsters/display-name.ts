/**
 * src/lib/monsters/display-name.ts
 * --------------------------------------------------------------------------
 * What the floating label above a monster's head says.
 *
 * The label was hardcoded to `spec.name`, the English name, so a Chinese player saw
 * "Barnacle Gunner" over a 藤壶炮手. Every other user-facing name in the game goes through
 * `pickText` — weapons, characters, drops, levels — and monsters were the one place that
 * skipped it.
 *
 * English stays English: `pickText` returns `name` when the locale is `en`, so this is one
 * call for both languages rather than a swap.
 */

import { pickText } from '@/locales';

/** The name to print above a monster, in the current locale. */
export function monsterDisplayName(spec: { name: string; nameZh?: string }): string {
    return pickText(spec.name, spec.nameZh);
}