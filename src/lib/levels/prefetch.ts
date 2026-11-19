/**
 * src/lib/levels/prefetch.ts
 * --------------------------------------------------------------------------
 * Pre-fetch planning: given a Level + the monster specs it references,
 * compute every drop id the runtime will need to look up. Used by
 * main.ts before constructing the Phaser scene so that monster-death
 * rolls (`rollDrops`) and static pickups both have their specs in hand.
 *
 * Without this, a monster dying would throw "Unknown drop id" because
 * its drop table references ids that were never loaded.
 */

import {
    CAT_SHOP_ACTION,
    CAT_SHOP_GIFT_DROP_ID,
    RICE_BOWL_ACTION,
    RICE_BOWL_DROP_ID,
} from './easter-eggs';
import type { Level } from './types';
import type { MonsterSpec } from '@/lib/monsters';

export function collectDropIds(level: Level, monsterSpecs: Map<string, MonsterSpec>): Set<string> {
    const ids = new Set<string>();
    level.dropSpawns?.forEach((d) => ids.add(d.type));
    // A trigger's reward is named only by the trigger itself, so a level that
    // ships one would otherwise reach fire time without its drop spec loaded.
    level.triggers?.forEach((t) => {
        // Only a spawn trigger names a drop; a travel trigger is a door.
        if ('spawn' in t) ids.add(t.spawn.type);
    });
    // The cabin cat's gift is launched from `scene.openCatShop`, whose drop id is not
    // named anywhere else in the level data. Without this the spec is missing at click
    // time and the rifle never appears.
    level.interactables?.forEach((item) => {
        if (item.action === CAT_SHOP_ACTION) ids.add(CAT_SHOP_GIFT_DROP_ID);
        // 饭盆同一个坑：那只不锈钢饭盆只由互动体发给玩家，关卡里没有任何 dropSpawns /
        // 怪物掉落引用它。不预取，背包就查不到名字和图标，直接把 `rice-bowl-basin` 印在格子里
        // （主人 2026-11-14 的截图正是这样）。
        if (item.action === RICE_BOWL_ACTION) ids.add(RICE_BOWL_DROP_ID);
    });
    monsterSpecs.forEach((spec) => {
        for (const ref of spec.drops ?? []) ids.add(ref.dropId);
    });
    return ids;
}

/**
 * Every monster id this level can put on the field.
 *
 * Hand-placed spawns were the only source for a long time, which was fine until the three
 * big worlds arrived: they carry no `monsters` rows at all and spawn from a `spawner` pool
 * instead. Nothing loaded those specs, so `RegionSpawner.spawnOne` found no spec, returned
 * silently - and because the wave still counted as fired, `isDone()` turned true and the exit
 * portal opened on an empty map. The owner's report: `进入图书馆、天空城、亚特之后没有刷怪，
 * 过了一会之后就出现传送阵了（自动通关了？）`.
 *
 * The boss is listed too: `boss.monsterType` may repeat a row from `monsters`, but nothing
 * guarantees it.
 */
export function collectMonsterIds(level: Level): string[] {
    const ids = new Set<string>();
    level.monsters?.forEach((m) => ids.add(m.type));
    level.spawner?.pool.melee.forEach((id) => ids.add(id));
    level.spawner?.pool.ranged.forEach((id) => ids.add(id));
    // 最后一波可以点名池子外的怪（三只守关 boss）。漏掉这一处，`spawnOne` 拿不到 spec
    // 就静静 `return`，于是「最后一只怪 + 两个云海德鲁伊没出现」——主人 2026-11-12 报的正是这个。
    level.spawner?.finalWave?.far?.forEach((id) => ids.add(id));
    if (level.boss) ids.add(level.boss.monsterType);
    return [...ids];
}
