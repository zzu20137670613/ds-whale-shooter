/**
 * src/lib/levels/schema.ts
 * --------------------------------------------------------------------------
 * Zod schema for the levels module.
 *
 * Legacy rect air walls (`x`/`y`/`width`/`height`) are still accepted
 * on input and migrated to 4-vertex polygons via `rectToPoints` —
 * older hand-drawn levels predate the polygon editor. Spawn points
 * use flat `{x, y}` (the earlier `at: [x, y]` form was removed when
 * every level YAML was rewritten).
 *
 * Single source of truth — `./types.ts` derives types via `z.infer`.
 */

import { z } from 'zod';

import { rectToPoints } from '@/lib/editor/polygon';

// ─── AirWall (polygon OR legacy rect) ────────────────────────────────────

const VertexSchema = z.tuple([z.number(), z.number()]);

const AirWallPolygonSchema = z
    .object({
        id: z.string().min(1),
        kind: z.enum(['tall', 'short']),
        points: z.array(VertexSchema).min(3),
    })
    .strict();

const AirWallRectSchema = z
    .object({
        id: z.string().min(1),
        kind: z.enum(['tall', 'short']),
        x: z.number(),
        y: z.number(),
        width: z.number().gt(0),
        height: z.number().gt(0),
    })
    .strict();

export const AirWallSchema = z.union([AirWallPolygonSchema, AirWallRectSchema]).transform((v) => {
    if ('points' in v) {
        return {
            id: v.id,
            kind: v.kind,
            points: v.points.map((p) => [Math.round(p[0]), Math.round(p[1])] as [number, number]),
        };
    }
    const rect = rectToPoints(v.x, v.y, v.width, v.height);
    return {
        id: v.id,
        kind: v.kind,
        points: rect.map((p) => [p.x, p.y] as [number, number]),
    };
});

// ─── Spawn entries (flat x, y only) ──────────────────────────────────────

export const CharacterSpawnSchema = z
    .object({
        facing: z.enum(['left', 'right']),
        x: z.number(),
        y: z.number(),
    })
    .strict()
    .transform((v) => ({ ...v, x: Math.round(v.x), y: Math.round(v.y) }));

/**
 * When a monster spawn is gated by a trigger instead of firing immediately
 * at level start. Pure data — runtime evaluation lives in
 * `src/game/monsters/monster.ts:advanceSpawnQueue`.
 *
 *   - `time`  fires at `levelStartElapsedMs + delayMs`.
 *   - `clear` fires once when no monster of the same `waveId` (or any
 *             monster, when `waveId` is omitted) is alive on the field,
 *             plus optional `delayMs` after that moment.
 *
 * `waveId` is optional on `MonsterSpawnSchema` itself so the same kind of
 * trigger can group multiple spawns into a "wave" that must all be cleared
 * before the next wave fires.
 */
export const MonsterTriggerSchema = z
    .object({
        kind: z.enum(['time', 'clear']),
        delayMs: z.number().gte(0).default(0),
        /** For `kind: 'clear'` — only this wave must be cleared. For
         *  `kind: 'time'` — tags which wave this spawn belongs to so
         *  subsequent `clear` triggers can wait on it. */
        waveId: z.string().min(1).optional(),
    })
    .strict();

export const MonsterSpawnSchema = z
    .object({
        type: z.string().min(1),
        x: z.number(),
        y: z.number(),
        trigger: MonsterTriggerSchema.optional(),
        /** Tag this spawn as part of a named wave so other triggers can
         *  wait on it via `trigger.waveId`. */
        waveId: z.string().min(1).optional(),
    })
    .strict()
    .transform((v) => ({ ...v, x: Math.round(v.x), y: Math.round(v.y) }));

export const DropSpawnSchema = z
    .object({
        type: z.string().min(1),
        x: z.number(),
        y: z.number(),
        /** Override the weapon id for type='weapon' drops. Lets the level
         *  YAML reuse a single generic drop spec for every weapon in the
         *  game without needing one drop YAML per weapon. The scene
         *  looks up the WeaponSpec by this id, uses its visual texture
         *  for the drop sprite and its name for the HUD, and forwards
         *  the id to the character on pickup. */
        weaponId: z.string().min(1).optional(),
        /**
         * 这一处摆位**只给一次**：捡走之后，这个 key 记进存档，任何关卡都不再摆。
         *
         * 为什么按"摆位"而不是按"道具"记：同一个道具可能有别的来源。
         * 深海特饮既摆在海滩那张图上，也会从怪身上掉；按道具 id 记的话，
         * 打死一只掉深海特饮的怪就会把那张图上的彩蛋一起吃掉。
         * 主人 2026-11-17：`想要做成跟王冠一样只能拣一次`。
         */
        onceKey: z.string().min(1).optional(),
    })
    .strict()
    .transform((v) => ({ ...v, x: Math.round(v.x), y: Math.round(v.y) }));

// ─── NpcSpawn (tavern-mode only) ──────────────────────────────────────────

/** A character NPC standing in the tavern for selection. */
export const NpcSpawnSchema = z
    .object({
        characterId: z.string().min(1),
        x: z.number(),
        y: z.number(),
    })
    .strict()
    .transform((v) => ({ ...v, x: Math.round(v.x), y: Math.round(v.y) }));

// ─── PlacedMaterial ───────────────────────────────────────────────────────

export const PlacedMaterialSchema = z
    .object({
        id: z.string().min(1),
        texture: z.string().min(1),
        x: z.number(),
        y: z.number(),
        scale: z.number().gt(0).optional(),
        rotation: z.number().optional(),
        flipX: z.boolean().optional(),
        flipY: z.boolean().optional(),
        mode: z.enum(['background', 'y-sort', 'foreground']).optional(),
        depthOffset: z.number().optional(),
    })
    .strict()
    .transform((v) => ({
        ...v,
        x: Math.round(v.x),
        y: Math.round(v.y),
    }));

// ─── Teleporter ───────────────────────────────────────────────────────────

export const FloorTextSchema = z
    .object({
        x: z.number(),
        y: z.number(),
        /** Newlines are honoured: a level can write a paragraph on the floor. */
        text: z.string().min(1),
        fontSize: z.number().positive().optional(),
        color: z.string().min(1).optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
    })
    .strict()
    .transform((v) => ({
        ...v,
        x: Math.round(v.x),
        y: Math.round(v.y),
    }));

export const TeleporterSchema = z
    .object({
        id: z.string().optional(),
        x: z.number(),
        y: z.number(),
        targetScene: z.string().optional(),
        /** 1-to-1 pairing: the id of the portal in `targetScene` that is this
         *  portal's only way back. Both sides of a pair name each other. */
        targetPortalId: z.string().min(1).optional(),
        /** Whether this portal stays dark until the level's monsters are
         *  cleared. Omitted means gated (the safe default); an always-usable
         *  portal such as the tavern exit says `false` explicitly. */
        requiresClear: z.boolean().optional(),
        radius: z.number().positive().default(40),
        /**
         * Only exists once the galgame's seal key has been typed into the nickname
         * dialog. Until then the portal is not drawn and cannot be entered.
         */
        hiddenUnlessUnlocked: z.boolean().optional(),
    })
    .strict()
    .transform((v) => ({
        ...v,
        ...(v.hiddenUnlessUnlocked ? { hiddenUnlessUnlocked: true } : {}),
        x: Math.round(v.x),
        y: Math.round(v.y),
    }));

// ─── Trigger ──────────────────────────────────────────────────────────────

/**
 * A one-shot region trigger: the first time the player walks into `zone` this
 * run, a drop pops out of `spawn.from`, arcs to `spawn.to` and lands there to
 * be picked up like any other ground drop. The scene records the trigger as
 * used (key `level:id`), so it stays spent for the rest of the run and only a
 * fresh run earns it again. Used by the beach lounger: step on the lounger, a
 * glass of iced juice pops out and lands on the side table.
 */
const TriggerZoneSchema = z
    .object({
        x: z.number(),
        y: z.number(),
        width: z.number().gt(0),
        height: z.number().gt(0),
    })
    .strict();

const zoneOut = (z0: { x: number; y: number; width: number; height: number }) => ({
    x: Math.round(z0.x),
    y: Math.round(z0.y),
    width: Math.round(z0.width),
    height: Math.round(z0.height),
});

/** Step into the zone, a reward drop pops out and arcs to a landing spot. */
export const SpawnTriggerSchema = z
    .object({
        id: z.string().min(1),
        zone: TriggerZoneSchema,
        /**
         * Only these characters can set it off. Omitted = anyone. Used by the
         * Sky City throne: the White Dragon Fangs is GPT's easter egg alone.
         */
        /**
         * What the character says when this trigger fires.
         *
         * `default` for everyone, plus per-character overrides by id. Rendered above her
         * head through `CHARACTER_SAY_EVENT`.
         */
        line: z
            .object({
                default: z.string().optional(),
                gpt: z.string().optional(),
                gemini: z.string().optional(),
                qwen: z.string().optional(),
                claude: z.string().optional(),
                deepseek: z.string().optional(),
            })
            .strict()
            .optional(),
        onlyCharacters: z.array(z.string().min(1)).optional(),
        /**
         * One firing PER CHARACTER instead of per save.
         *
         * The throne egg is a line plus a fang: GPT has already found it in the owner's save,
         * and a save-wide key meant nobody else could ever trigger it (`使用鲸鱼娘站到了龙王
         * 宝座上，没掉白龙獠牙`). With this, each character earns it once.
         */
        perCharacter: z.boolean().optional(),
        /**
         * A cut-scene to play the moment this trigger fires.
         *
         * Path under `public/`. The Sky City throne uses it for 一夜鱼龙舞 (`捡獠牙的时候播放`).
         * Declared here rather than keyed off the trigger id in code, so a second reward can
         * want a video without anybody touching the controller.
         */
        video: z.string().min(1).optional(),
        spawn: z
            .object({
                /** Drop spec id, e.g. `beach-drink`. */
                type: z.string().min(1),
                /** For `type: 'weapon-drop'` — which weapon to drop. */
                weaponId: z.string().min(1).optional(),
                /** Where the pickup pops out - the lounger. */
                from: z.object({ x: z.number(), y: z.number() }).strict(),
                /** Where it lands and waits - the side table. */
                to: z.object({ x: z.number(), y: z.number() }).strict(),
                /** How high the arc rises above the straight line, in px. */
                lift: z.number().gte(0).default(90),
                /** How long the flight takes, in ms. */
                durationMs: z.number().gt(0).default(700),
            })
            .strict(),
    })
    .strict()
    .transform((v) => ({
        id: v.id,
        zone: zoneOut(v.zone),
        ...(v.onlyCharacters ? { onlyCharacters: v.onlyCharacters } : {}),
        ...(v.line ? { line: v.line } : {}),
        ...(v.perCharacter ? { perCharacter: v.perCharacter } : {}),
        // Copied explicitly: the transform is the boundary between YAML and the controller, and a
        // field it forgets is a field that silently stops working (the throne clip was).
        ...(v.video ? { video: v.video } : {}),
        spawn: {
            type: v.spawn.type,
            ...(v.spawn.weaponId ? { weaponId: v.spawn.weaponId } : {}),
            from: { x: Math.round(v.spawn.from.x), y: Math.round(v.spawn.from.y) },
            to: { x: Math.round(v.spawn.to.x), y: Math.round(v.spawn.to.y) },
            lift: v.spawn.lift,
            durationMs: v.spawn.durationMs,
        },
    }));

/**
 * Step into the zone and the game moves to another scene — a hidden door.
 *
 * Deliberately silent: no glow, no prompt, no sound. `excludeCharacters` is how
 * a door refuses a specific character without spending itself: Claude stepping
 * on the Atlantean throne must do nothing at all AND leave the trigger armed,
 * otherwise a Claude run would burn the entrance for the rest of the save.
 */
export const TravelTriggerSchema = z
    .object({
        id: z.string().min(1),
        zone: TriggerZoneSchema,
        travel: z
            .object({
                targetScene: z.string().min(1),
                /** Character ids that must NOT be able to use this door. */
                excludeCharacters: z.array(z.string().min(1)).default([]),
                /**
                 * The door stays shut until the map is cleared.
                 *
                 * The owner: `全部打掉后复用boss战的箭头逻辑，指向王座前往boss战` - the throne is
                 * the way in, but only once the four waves are done, or the waves are scenery.
                 */
                requiresClear: z.boolean().default(false),
            })
            .strict(),
    })
    .strict()
    .transform((v) => ({
        id: v.id,
        zone: zoneOut(v.zone),
        travel: {
            targetScene: v.travel.targetScene,
            excludeCharacters: v.travel.excludeCharacters,
            requiresClear: v.travel.requiresClear,
        },
    }));

/**
 * A click target painted into the art: rectangles of the world that answer to
 * the mouse instead of to the player's feet. `action` is a string, not an enum,
 * so the scene can dispatch new ones without a schema change.
 */
export const InteractableSchema = z
    .object({
        id: z.string().min(1),
        action: z.string().min(1),
        zones: z.array(TriggerZoneSchema).min(1),
        /**
         * `walk` = 走进去就触发；`enter` = 一进这张图就触发（饭盆，2026-11-15）；
         * 不写 = 点击触发（驾驶舱屏幕）。
         */
        trigger: z.enum(['click', 'walk', 'enter']).optional(),
    })
    .strict()
    .transform((v) => ({
        id: v.id,
        action: v.action,
        zones: v.zones.map(zoneOut),
        ...(v.trigger !== undefined ? { trigger: v.trigger } : {}),
    }));

/** A one-shot region trigger, in either of its two effects. */
export const TriggerSchema = z.union([SpawnTriggerSchema, TravelTriggerSchema]);

// ─── Level ────────────────────────────────────────────────────────────────

/**
 * A level whose ground is a tilemap instead of one painted background image.
 *
 * `background` stays required for now — the editor panel and the YAML
 * round-trip both still write it — but LoadScene skips loading it when this
 * block is present, so a tiled level pays nothing for the field it ignores.
 */
export const TilemapSchema = z
    .object({
        /** Tiled JSON, as produced by `scripts/build-tilemap.ts`. */
        map: z.string().min(1),
        /** Atlas PNG that the map's tileset draws from. */
        tileset: z.string().min(1),
    })
    .strict();

/**
 * One art block of a level whose world is wider than a single painted
 * background: four 5504x3072 blocks side by side make an 11008x6144 world out
 * of exactly the images the art was painted at. One 11008-wide texture would
 * be 258 MiB resident and can exceed the driver's maximum texture size, which
 * is the reason a big world is assembled from blocks instead.
 *
 * `background` stays required for the same reason as `tilemap` above — the
 * editor panel and the YAML round-trip still write it — but LoadScene skips
 * loading it when this list is present. The editor's wall canvas still draws
 * `background` alone, so it shows the first block of such a level.
 */
export const BackgroundBlockSchema = z
    .object({
        /** PNG under public/, one painted block of the world. */
        texture: z.string().min(1),
        /** Top-left corner of this block in level coordinates. */
        x: z.number(),
        y: z.number(),
    })
    .strict()
    .transform((v) => ({
        ...v,
        x: Math.round(v.x),
        y: Math.round(v.y),
    }));

/**
 * Follow-spawn: entering one of the first few quadrants of the map drops a wave
 * around the player. Off by default; only the big levels opt in.
 *
 * `pool` is split by role because a wave's shape is fixed - 2 melee + 2 ranged
 * close, 2 melee + 3 ranged on the edges - so the only per-level choice is which
 * monster fills each role.
 */
const SpawnerPoolSchema = z
    .object({
        melee: z.array(z.string().min(1)).default([]),
        ranged: z.array(z.string().min(1)).default([]),
    })
    .strict();

export const RegionSpawnerSchema = z
    .object({
        /** Grace period after the player enters a fresh quadrant. */
        delayMs: z.number().gte(0).default(2000),
        /** How many quadrants get a wave (the first N entered, each once). */
        waves: z.number().int().gte(1).lte(4).default(3),
        near: z
            .object({
                count: z.number().int().gte(0).default(4),
                /** Ring around the player, in px. */
                minDistance: z.number().gt(0).default(300),
                maxDistance: z.number().gt(0).default(900),
            })
            .strict()
            .default({ count: 4, minDistance: 300, maxDistance: 900 }),
        far: z
            .object({
                count: z.number().int().gte(0).default(5),
                /** How far inside the quadrant's edge the points sit. */
                edgeInset: z.number().gte(0).default(200),
                /**
                 * How far a far point keeps from the WORLD's corners.
                 *
                 * A quadrant edge on the outside of the map IS the map border, so without this
                 * a wave can spawn in the corner of the painting - water, rocks, or under the
                 * HUD (`亚特兰蒂斯有怪刷到了角落里`).
                 */
                cornerInset: z.number().gte(0).default(0),
            })
            .strict()
            .default({ count: 5, edgeInset: 200, cornerInset: 0 }),
        /**
         * How much tougher the level's MELEE pool monsters are, as a multiple of their own
         * YAML health.
         *
         * The owner tunes this per level (`将图书馆的近战怪物血量*2，天空城的近战怪物血量*3，
         * 亚特的近战怪物血量*4`). Same monster, different map, different cost to clear.
         */
        meleeHpMultiplier: z.number().gt(0).default(1),
        /**
         * Health multiplier for EVERY monster this spawner creates, melee and ranged alike.
         *
         * Multiplies on top of `meleeHpMultiplier`, so a melee wave on a map with both dials
         * doubled ends up four times its YAML health.
         */
        hpMultiplier: z.number().gt(0).default(1),
        /**
         * Rectangles a wave may never spawn in, in world px.
         *
         * Wall checks are not enough on a painted map: the pavilion roof is walkable floor as
         * far as the collision grid knows, so a far-edge point landed on the tiles and the
         * monster stood inside the roof art (`有一只怪刷墙里去了`).
         */
        exclude: z
            .array(
                z
                    .object({
                        x: z.number(),
                        y: z.number(),
                        width: z.number().gt(0),
                        height: z.number().gt(0),
                    })
                    .strict(),
            )
            .default([]),
        pool: SpawnerPoolSchema,
        /**
         * 最后一波（第 `waves` 波）的配比覆盖。
         *
         * 主人 2026-11-12：`把三大关中每一关最后一波（第三波）的怪物配比调出来，我给你配置一下
         * 最后一关的配比`。`far` 一项一只怪、按顺序占远处边缘的槽位，可以点名池子外的怪物
         * （三只守关 boss 就是这么做进第三波的）。
         */
        finalWave: z
            .object({
                near: z
                    .object({
                        melee: z.number().int().gte(0).optional(),
                        ranged: z.number().int().gte(0).optional(),
                    })
                    .strict()
                    .optional(),
                far: z.array(z.string().min(1)).optional(),
            })
            .strict()
            .optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
        if (value.near.count + value.far.count <= 0) return;
        if (value.pool.melee.length === 0 && value.pool.ranged.length === 0) {
            ctx.addIssue({
                code: 'custom',
                message: 'spawner needs at least one monster in pool.melee or pool.ranged',
                path: ['pool'],
            });
        }
    });

export const LevelSchema = z
    .object({
        title: z.string().min(1),
        /** Chinese title — resolved by `pickText()` where the level title
         *  reaches the HUD. Optional. */
        titleZh: z.string().min(1).optional(),
        background: z.string().min(1),
        tilemap: TilemapSchema.optional(),
        backgroundBlocks: z.array(BackgroundBlockSchema).optional(),
        triggers: z.array(TriggerSchema).optional(),
        interactables: z.array(InteractableSchema).optional(),
        imageSize: z.string().regex(/^\d+x\d+$/, 'expected "WxH"'),
        prompt: z.string().optional(),
        music: z.string().min(1).optional(),
        pixelLighting: z.boolean().optional(),
    /**
     * 词元盾光柱的深浅。亮色背景（天空之城）用 `dark`，深色地图用 `bright`（默认）。
     */
    tokenPillarTone: z.enum(['bright', 'dark', 'gold']).optional(),
    /**
     * 这一关打 Claude 的哪一阶段（1 起）。四块拆开的地图各打一阶段；
     * 主人：`四关匹配 boss 4 阶段，最后一个阶段取消`。
     */
    bossPhase: z.number().int().min(1).max(5).optional(),
        /** When true, LoadScene enters tavern mode: character NPCs are
         *  rendered for selection; no monsters; weapon pick-up capped at 3. */
        tavern: z.boolean().optional(),
        airWalls: z.array(AirWallSchema),
        character: z.string().min(1).optional(),

        /**
         * A comic that plays over the level the first time it loads — the hidden
         * level opens on 34 pages of the story that got it here. `pages` is the
         * count; the files are `assets/image/comic/<levelId>-NN.jpg`.
         */
        /**
         * The monster whose death ends this level: the scene hands over to the
         * settlement sequence instead of the normal clear-the-map victory.
         */
        boss: z
            .object({ monsterType: z.string().min(1) })
            .strict()
            .optional(),

        introComic: z
            .object({ pages: z.number().int().gt(0) })
            .strict()
            .optional(),
        characterSpawn: CharacterSpawnSchema.optional(),
        /** Tavern-mode only: per-character NPC standing positions. */
        npcSpawns: z.array(NpcSpawnSchema).optional(),
        monsters: z.array(MonsterSpawnSchema).optional(),
        /** Follow-spawn configuration; absent means hand-placed monsters only. */
        /**
     * Where the mysterious merchant stands, when the middle of the map is occupied.
     *
     * Default is the exact centre (`神秘商人放在地图正中心`), but a level whose centre is a
     * solid prop - the library terrace has its round table right there - can name another
     * foot point instead of parking her inside it.
     */
    merchantAt: z.object({ x: z.number(), y: z.number() }).strict().optional(),
    spawner: RegionSpawnerSchema.optional(),
        /**
         * The arrow that points at the way out once the map is clear.
         *
         * Same visual as the boss walk's arrows (`createArenaArrow`) so the player learns the
         * shape once: walk into it and the level's travel trigger does the rest.
         */
        /**
         * Where the boss stands in each of the four blocks, in walk order.
         *
         * Authored because "the middle of the block" is not where the fight reads best: the
         * owner marked the three spots by hand on the map, and the ruins keep the spawn the
         * monster row already had. Missing entries fall back to the block centre.
         */
        arenaSpawn: z
            .array(z.object({ x: z.number(), y: z.number() }).strict())
            .max(4)
            .optional(),
        exitArrow: z
            .object({
                x: z.number(),
                y: z.number(),
                direction: z.enum(['up', 'down', 'left', 'right']).default('up'),
                /**
                 * Ride beside the player instead of standing on the floor.
                 *
                 * Atlantis asks for this: the arrow to the throne should behave like the
                 * last-monster pointer, not like a signpost you can walk past.
                 */
                orbit: z.boolean().default(false),
            })
            .strict()
            .optional(),
        dropSpawns: z.array(DropSpawnSchema).optional(),
        materials: z.array(PlacedMaterialSchema).optional(),
        teleporters: z.array(TeleporterSchema).optional(),
        floorText: z.array(FloorTextSchema).optional(),
    })
    .strict()
    .transform((v) => {
        const [w, h] = v.imageSize.split('x');
        return {
            title: v.title,
            ...(v.titleZh !== undefined ? { titleZh: v.titleZh } : {}),
            background: v.background,
            ...(v.tilemap !== undefined ? { tilemap: v.tilemap } : {}),
            ...(v.backgroundBlocks !== undefined ? { backgroundBlocks: v.backgroundBlocks } : {}),
            ...(v.triggers !== undefined ? { triggers: v.triggers } : {}),
            imageSize: { width: Number(w), height: Number(h) },
            airWalls: v.airWalls,
            ...(v.prompt !== undefined ? { prompt: v.prompt } : {}),
            ...(v.music !== undefined ? { music: v.music } : {}),
            ...(v.pixelLighting !== undefined ? { pixelLighting: v.pixelLighting } : {}),
        ...(v.tokenPillarTone !== undefined ? { tokenPillarTone: v.tokenPillarTone } : {}),
        ...(v.bossPhase !== undefined ? { bossPhase: v.bossPhase } : {}),
            ...(v.tavern !== undefined ? { tavern: v.tavern } : {}),
            ...(v.character !== undefined ? { character: v.character } : {}),
            ...(v.introComic !== undefined ? { introComic: v.introComic } : {}),
            ...(v.boss !== undefined ? { boss: v.boss } : {}),
            ...(v.interactables !== undefined ? { interactables: v.interactables } : {}),
            ...(v.characterSpawn !== undefined ? { characterSpawn: v.characterSpawn } : {}),
            ...(v.npcSpawns !== undefined ? { npcSpawns: v.npcSpawns } : {}),
            ...(v.monsters !== undefined ? { monsters: v.monsters } : {}),
            ...(v.dropSpawns !== undefined ? { dropSpawns: v.dropSpawns } : {}),
            ...(v.materials !== undefined ? { materials: v.materials } : {}),
            ...(v.spawner !== undefined ? { spawner: v.spawner } : {}),
            ...(v.exitArrow !== undefined ? { exitArrow: v.exitArrow } : {}),
            ...(v.arenaSpawn !== undefined ? { arenaSpawn: v.arenaSpawn } : {}),
            ...(v.merchantAt !== undefined ? { merchantAt: v.merchantAt } : {}),
        ...(v.teleporters !== undefined ? { teleporters: v.teleporters } : {}),
            ...(v.floorText !== undefined ? { floorText: v.floorText } : {}),
        };
    });

// ─── LevelIndex ───────────────────────────────────────────────────────────

export const LevelIndexSchema = z
    .object({
        levels: z.array(z.string().min(1)),
    })
    .strict();

export type FloorText = z.infer<typeof FloorTextSchema>;
