/**
 * src/lib/drops/schema.ts
 * --------------------------------------------------------------------------
 * Zod schema for the drops module — single source of truth for both runtime
 * validation (used by parser.ts on YAML load + by editor save-time check)
 * AND the TypeScript types in `./types.ts` (derived via `z.infer`).
 *
 * Discriminated union on `effect.type` mirrors the original hand-rolled
 * branch logic; `.strict()` rejects extra keys so a typo in the YAML is
 * caught instead of silently swallowed.
 *
 * Zod 4 note: `z.number()` already rejects NaN and Infinity, so there's
 * no need for the (now-deprecated) `finite()` / `safe()` helpers.
 */

import { z } from 'zod';

// ─── Visual ───────────────────────────────────────────────────────────────

export const DropVisualSchema = z
    .object({
        size: z.number().gt(0),
        tint: z.number(),
    })
    .strict();

// ─── Effect (discriminated union) ─────────────────────────────────────────

const InstantEffectSchema = z
    .object({
        type: z.literal('instant'),
        hp: z.number().gte(0).default(0),
        sp: z.number().gte(0).default(0),
    })
    .strict()
    .refine((v) => v.hp > 0 || v.sp > 0, {
        message: 'instant effect needs hp > 0 or sp > 0',
    });

const RefillAmmoEffectSchema = z
    .object({
        type: z.literal('refill-ammo'),
        ammoFraction: z.number().gt(0).lte(1),
    })
    .strict();

const FullRestoreEffectSchema = z
    .object({
        type: z.literal('full-restore'),
    })
    .strict();

/**
 * A pickup that is not used, only kept and sold. The barnacle is the first one:
 * one drops from every monster, and the shop pays `sellPrice` per unit.
 */
const MaterialEffectSchema = z
    .object({
        type: z.literal('material'),
        /** Coins per unit when sold. 0 until a price is decided. */
        sellPrice: z.number().gte(0).default(0),
    })
    .strict();

/**
 * 词元盾：不进背包，拾取就把角色的护盾等级 +1（最多 5 级），
 * 之后受伤时按等级把一部分伤害转成掉蓝量。主人 2026-11-12 定的。
 */
const TokenShieldEffectSchema = z
    .object({
        type: z.literal('token-shield'),
    })
    .strict();

/**
 * 「带在身上就生效」的上限加成 —— 加冕之冠（主人 2026-11-17）。
 *
 * 和 `token-shield` 的区别：盾是拾取即生效、不进背包；这个**留在背包里**当被动加成，
 * 拿走（卖掉/没了）上限就回落。所以在 `use-check` 的自动使用里不出现，也不消耗。
 */
const MaxBonusEffectSchema = z
    .object({
        type: z.literal('max-bonus'),
        /** 血上限 +N。省略等于 0。 */
        hp: z.number().gte(0).default(0),
        /** 蓝上限 +N。省略等于 0。 */
        sp: z.number().gte(0).default(0),
    })
    .strict();

const WeaponEffectSchema = z
    .object({
        type: z.literal('weapon'),
        weaponId: z.string().min(1),
    })
    .strict();

export const DropEffectSchema = z.discriminatedUnion('type', [
    InstantEffectSchema,
    RefillAmmoEffectSchema,
    FullRestoreEffectSchema,
    MaterialEffectSchema,
    WeaponEffectSchema,
    TokenShieldEffectSchema,
    MaxBonusEffectSchema,
]);

// ─── DropSpec ─────────────────────────────────────────────────────────────
//
// `id` is set by the loader from the filename; the schema accepts it as
// an optional field so test fixtures (which build the object directly)
// can include it. The loader still overwrites it with the canonical id.

import { SpriteSchema, AnimSpecSchema } from '@/lib/monsters/schema';

export const DropSpecSchema = z
    .object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),
        /** Chinese display name, shown in the backpack. */
        nameZh: z.string().min(1).optional(),
        /** 背包里显示的一句话说明；未至之境的关键道具就是靠它说"敬请期待"。 */
        description: z.string().min(1).optional(),
        descriptionZh: z.string().min(1).optional(),
        /**
         * 背包里点它、但它现在用不了时说的话。不写就走通用的
         * `backpack.cannotUse`（「这个不能在这里使用」）。
         * 主人 2026-11-15：饭盆要单独说清它是未至之境的关键道具。
         */
        unusableNotice: z.string().min(1).optional(),
        unusableNoticeZh: z.string().min(1).optional(),
        /**
         * 捡起来时冒一行字。主人 2026-11-17：`拾取的时候给个文字提示`（加冕之冠）。
         * 只在**真的进了背包**之后才显示 —— 背包满了不算拿到。
         */
        pickupNotice: z.string().min(1).optional(),
        pickupNoticeZh: z.string().min(1).optional(),
        /**
         * 只在**这些关卡**弹拾取台词。不写 = 哪一关都弹。
         *
         * 主人 2026-11-17：`做两层绑定吧……另一层就查地图名是不是海滩假日，
         * 同时满足才弹台词` —— 同一个道具在别处也会掉落（深海特饮就同时是怪物的掉落），
         * 台词说"礁石上"，那在别的地方弹出来就是错的。
         */
        pickupNoticeLevels: z.array(z.string().min(1)).optional(),
        /** Coins a shop pays per unit. Missing = not sellable yet. */
        sellPrice: z.number().gte(0).optional(),
        kind: z.enum(['static', 'monster']),
        visual: DropVisualSchema,
        effect: DropEffectSchema,
        /** SFX id to play on pickup. Falls back to a generic pickup tone
         *  in the controller when omitted. */
        sfx: z.string().min(1).optional(),
        /** Per-drop throttle on the pickup SFX so simultaneous kills
         *  dropping the same item don't stack overlapping pickup tones.
         *  Keyed per-drop-id. */
        throttleMs: z.number().gt(0).optional(),
        sprite: SpriteSchema.optional(),
        /**
         * 落地时在地上竖一道光柱，颜色由物品自己定：
         * `gold` 词元盾 / `violet` 白龙獠牙 / `bright` 未至之境（预留）。
         */
        beam: z.enum(['gold', 'violet', 'bright']).optional(),
        anims: z.record(z.string(), AnimSpecSchema).optional(),
        prompt: z.string().optional(),
    })
    .strict();

// ─── Index ────────────────────────────────────────────────────────────────

export const DropIndexSchema = z
    .object({
        drops: z.array(z.string().min(1)),
    })
    .strict();
