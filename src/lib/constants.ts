/**
 * src/lib/constants.ts
 * --------------------------------------------------------------------------
 * Engine / structural constants — anything that is NOT a game-data value
 * goes here, prefixed by category so they're easy to scan and so a
 * missing import surface-area is obvious.
 *
 * Data-driven values (character body, weapon projectile visual, drop
 * visual, …) live in the relevant module's YAML files. This file is
 * only for the things that are "the same everywhere".
 */

// ─── Physics: Matter collision category bits + composite masks ──────────

export const CAT = {
    WALL_TALL: 0x0001,
    WALL_SHORT: 0x0002,
    CHARACTER: 0x0004,
    BULLET: 0x0008,
    MONSTER_MELEE: 0x0010,
    MONSTER_PROJECTILE: 0x0020,
} as const;

// ─── Rendering Depths / Z-Indices ─────────────────────────────────────
// Per-entity Y-sort: the player and every monster derive their sprite /
// shadow / bullet / weapon depths from their own footY (world Y). Two
// entities overlap correctly on screen based on whose feet are lower.
// `DEPTH.CHARACTER` / `BULLET` / `WEAPON` below are FALLBACKS for
// callers that don't supply a footY (tests, off-character plumbing).
/**
 * How close two bag-item clicks may be before they count as one, in ms.
 *
 * A duplicated `inventory:use` listener (one per level load, before the drop system was
 * torn down) consumed one item per listener; 200ms is longer than a double-fire and far
 * shorter than a deliberate second click.
 */
export const DROP_USE_DEDUPE_MS = 200;

/**
 * Keys that toggle the backpack, lower-case.
 *
 * The owner asked for both: `给背包加个I键（I键，B键都是背包键）`. B was the original hint
 * printed in the HUD; I is the one hands rest on in most shooters.
 */
export const KEY_BACKPACK: readonly string[] = ['b', 'i'];

export const DEPTH = {
    BACKGROUND_IMAGE: 0,
    LIGHT: 1, // Renders over background image, under all materials, walls, and entities
    MATERIAL_BACKGROUND: 10,
    BULLET_TRAIL: 15,
    CHARACTER: 20, // Fallback sprite depth when no footY is supplied
    BULLET: 30, // Fallback bullet depth when no footY is supplied
    WEAPON: 40, // Fallback weapon depth when no footY is supplied
    FOREGROUND_MATERIAL: 10000,
    MELEE_SLASH: 12000, // Slash arc always above foreground materials
    SELECTION_BOX: 15000,
    HUD: 20000,
} as const;

/** Categories that block the player's body (walls). */
export const WALL_PLAYER_MASK: number = CAT.WALL_TALL | CAT.WALL_SHORT;

/** Categories that damage the player on contact. */
export const CHARACTER_DAMAGE_MASK: number =
    CAT.WALL_TALL | CAT.WALL_SHORT | CAT.MONSTER_MELEE | CAT.MONSTER_PROJECTILE;

/** Categories that player bullets should hit. */
export const BULLET_HIT_MASK: number =
    CAT.WALL_TALL | CAT.WALL_SHORT | CAT.MONSTER_MELEE | CAT.MONSTER_PROJECTILE;

/** Categories a drop sensor responds to (character only). */
export const DROP_PICKUP_MASK: number = CAT.CHARACTER;

/** Player bullets hit tall walls + monsters, pass over short walls (cover).
 *  Symmetric to PROJECTILE_MONSTER_MASK. */
export const PROJECTILE_PLAYER_MASK: number =
    CAT.WALL_TALL | CAT.MONSTER_MELEE | CAT.MONSTER_PROJECTILE;

/** Monster projectiles hit player + tall walls. Symmetric to player. */
export const PROJECTILE_MONSTER_MASK: number = CAT.CHARACTER | CAT.WALL_TALL;

// ─── Input: Phaser keycodes (stable browser standard) ───────────────────
// Phaser's runtime top-level reads browser globals, so we can't import
// `Input.Keyboard.KeyCodes` from a Node-runnable test. Mirror the
// numeric values here — they're part of the browser standard.

export const KEY_W = 87;
export const KEY_A = 65;
export const KEY_S = 83;
export const KEY_D = 68;
export const KEY_SHIFT = 16;
export const KEY_SPACE = 32;
export const KEY_ONE = 49;
export const KEY_TWO = 50;
export const KEY_THREE = 51;
export const KEY_FOUR = 52;
export const KEY_FIVE = 53;
export const KEY_SIX = 54;
export const KEY_SEVEN = 55;
export const KEY_R = 82;
export const KEY_E = 69;
/** Manual reload. F is the habit key; R keeps working as the alias. */
export const KEY_F = 70;
/** Cycle weapons (Q). */
export const KEY_Q = 81;
/** Fire, for scheme B. J is where the right hand rests on the ASDF home row. */
export const KEY_J = 74;
/** Dodge, alongside space — K sits under the middle finger, same home row. */
export const KEY_K = 75;
/** Eight-way aim, for scheme B. */
export const KEY_UP = 38;
export const KEY_DOWN = 40;
export const KEY_LEFT = 37;
export const KEY_RIGHT = 39;

// ─── Weapons: reserve ammunition ──────────────────────────────────────────
/**
 * Reserve ammunition, counted in magazines: `2 + upgradeLevel`.
 *
 * A fresh weapon carries two magazines of spares, and every bought upgrade adds
 * one more, so the whale cannon walks 2/4 -> 2/6 -> 2/8 while its magazine stays
 * at 2. Only the reserve grows: buying firepower must not also buy a bigger clip.
 */
/**
 * Extra reach per weapon upgrade level, compounded: 1.1^5 = 1.61, so a maxed
 * ranged weapon reaches ~61% further.
 *
 * Melee is excluded on purpose - a melee `range` positions the swing hitbox.
 */
export const WEAPON_RANGE_PER_LEVEL = 0.1;

/**
 * Reload speed-up per weapon upgrade level, subtracted from the BASE: five levels
 * = exactly half the reload time.
 *
 * Linear because the owner stated the target as a fact ("满级比初始快一倍").
 * Compounding 0.9 five times would give 0.59, which is not "twice as fast".
 */
export const WEAPON_RELOAD_PER_LEVEL = 0.1;
/** Never let a (future, longer) ladder reach an instant reload. */
export const WEAPON_RELOAD_MIN_FACTOR = 0.3;

export const AMMO_RESERVE_BASE_CLIPS = 2;
export const AMMO_RESERVE_CLIPS_PER_LEVEL = 1;

// ─── HUD: shared layout values (apply to all HUDs) ────────────────────

/** Distance from screen bottom for both character-hub + weapon-hud. */
export const HUD_BOTTOM_GAP = 14;

/** Inner padding around HUD content. */
export const HUD_BG_PAD = 4;

/** Shared bar/panel recessed-track colour (slate-800). */
export const HUD_BAR_BG = 0x1f2937;

/** Shared translucent panel backdrop (black @ alpha). */
export const HUD_PANEL_BG = 0x000000;

// ─── HUD: character-hub (HP / SP bars) ─────────────────────────────────

export const HUD_HP_PANEL_PADDING_X = 12;
export const HUD_HP_BAR_W = 220;
export const HUD_HP_BAR_H = 14;
export const HUD_HP_BAR_GAP = 6;
export const HUD_HP_NAME_OFFSET_Y = 4;

// ─── HUD: weapon-hud (hotbar) ─────────────────────────────────────────

export const HUD_WEAPON_PANEL_PADDING = 14;
export const HUD_WEAPON_PANEL_W = 244;
export const HUD_WEAPON_PANEL_H = 116;
export const HUD_WEAPON_SLOT_SIZE = 56;
export const HUD_WEAPON_SLOT_GAP = 8;
export const HUD_WEAPON_AMMO_BAR_Y = 32;
export const HUD_WEAPON_AMMO_BAR_H = 6;

// ─── HUD: status-hud (head reload indicator) ──────────────────────────

export const HUD_STATUS_BAR_W = 60;
export const HUD_STATUS_BAR_H = 4;
/** Offset above character center for the status bar. */
export const HUD_STATUS_OFFSET_Y = -34;
/** Duration of the "Full" fade-out after reload completes. */
export const HUD_COMPLETED_FLASH_MS = 600;
/** Track + fill base colour for the status bar. */
export const HUD_STATUS_BAR_BG = 0x052e16;
export const HUD_STATUS_BAR_FILL = 0xbbf7d0;
export const HUD_STATUS_LABEL_COLOR = '#bbf7d0';

/** Alpha applied to the track background. */
export const HUD_BG_ALPHA = 0.85;

/** Alpha for partial-fill rendering (HP / SP / reload / status). */
export const HUD_FILL_ALPHA = 0.95;

// ─── HUD: theme colors (fill + text) ──────────────────────────────────

/** Bar fill colours. */
export const HUD_HP_FILL = 0x22c55e; // green-500 — health
export const HUD_SP_FILL = 0x38bdf8; // sky-400   — stamina

/** Ammo / reload / hotbar fills. */
export const HUD_RELOAD_FILL = 0xfbbf24; // amber-400 — reload progress
export const HUD_SLOT_ACTIVE_FILL = 0xfde68a; // amber-200 — active slot bg
export const HUD_SLOT_INACTIVE_FILL = 0x1e293b; // slate-800 — inactive slot bg
export const HUD_SLOT_ACTIVE_BORDER = 0x92400e; // amber-800 — active slot border
export const HUD_SLOT_INACTIVE_BORDER = 0x334155; // slate-700 — inactive slot border

/** Bar / panel track colours. */
export const HUD_BAR_TRACK_ALPHA = 0.85;
export const HUD_PANEL_BG_ALPHA = 0.5;
export const HUD_PANEL_BORDER_ALPHA = 0.9;
export const HUD_WEAPON_PANEL_ALPHA = 0.55;
export const HUD_PANEL_RADIUS = 8;

/** CSS text colours. */
export const HUD_TEXT_NAME = '#86efac'; // green-300
export const HUD_TEXT_AMMO_BIG = '#fef3c7'; // amber-100
export const HUD_TEXT_DIM = '#94a3b8'; // slate-400
export const HUD_TEXT_LABEL = '#cbd5e1'; // slate-300
export const HUD_TEXT_AMMO_SMALL = '#e2e8f0'; // slate-200
export const HUD_TEXT_WEAPON_NAME = '#fde68a'; // amber-200
export const HUD_TEXT_ACTIVE = '#92400e'; // amber-800

/** Shared font sizes (px). */
export const HUD_FONT_NAME = '12px';
export const HUD_FONT_WEAPON_NAME = '13px';
export const HUD_FONT_AMMO_BIG = '22px';
export const HUD_FONT_SLOT_KEY = '11px';
export const HUD_FONT_LABEL = '10px';

/** Panel text padding from panel inner edge (px). */
export const HUD_WEAPON_TEXT_PAD_X = 12;
export const HUD_WEAPON_TEXT_PAD_Y_TOP = 8;
export const HUD_WEAPON_AMMO_BIG_OFFSET_Y = 6;
export const HUD_WEAPON_AMMO_MAX_OFFSET_Y = 32;
export const HUD_WEAPON_AMMO_BAR_X = 12;
export const HUD_WEAPON_SLOT_KEY_OFFSET_X = 4;
export const HUD_WEAPON_SLOT_KEY_OFFSET_Y = 2;
export const HUD_WEAPON_SLOT_AMMO_OFFSET_X = -4;
export const HUD_WEAPON_SLOT_AMMO_OFFSET_Y = -14;
export const HUD_WEAPON_SLOT_LABEL_OFFSET_Y = -4;
export const HUD_WEAPON_SLOT_BORDER_ACTIVE = 2;
export const HUD_WEAPON_SLOT_BORDER_INACTIVE = 1;
export const HUD_WEAPON_SLOT_OFFSET_X = 12;
export const HUD_WEAPON_SLOT_BOTTOM_GAP = 8;
export const HUD_WEAPON_AMMO_BAR_INSET = 24;

/** Status bar: bar-local vertical offset for the "Reloading…/Full" caption. */
export const HUD_STATUS_LABEL_OFFSET_Y = -2;

// ─── Token Shield: light pillar tone ────────────────────────────────────
/**
 * 词元盾光柱的两套配色：深色地图用亮色柱，亮色地图用深色柱。
 *
 * 主人 2026-11-12：`图书馆和亚特的最后一关背景都偏暗，符文盾亮色关注没问题，天空之城背景偏亮，
 * 需要把天空之城掉落的符文盾光柱变深色光柱`。哪张图用哪套存在关卡数据里
 * （`tokenPillarTone`），不是代码里的地图名单。
 */
export type TokenPillarTone = 'bright' | 'dark' | 'gold';

export interface TokenPillarPalette {
    /** Column fill. */
    fill: number;
    fillAlpha: number;
    /** Ground ellipse under the shield. */
    glow: number;
    glowAlpha: number;
    /** ADD washes out on a bright plate, so the dark tone draws normally. */
    useAdditive: boolean;
}

export const TOKEN_PILLAR_PALETTES: Record<TokenPillarTone, TokenPillarPalette> = {
    bright: { fill: 0xe9d5ff, fillAlpha: 0.32, glow: 0xd8b4fe, glowAlpha: 0.55, useAdditive: true },
    // 主人 2026-11-12：`将深色光柱都改成紫色`。紫罗兰实心柱，亮底/暗底都读得出来。
    dark: { fill: 0x8b5cf6, fillAlpha: 0.55, glow: 0xa855f7, glowAlpha: 0.65, useAdditive: false },
    // 主人 2026-11-12（测完之后）：`图书馆和亚特兰蒂斯的词元盾光柱都改成深金色`。
    // 深金 = 暖色，在冷调的蓝/紫底图上对比最强，也不至于像亮色柱那样糊成一片。
    // 主人 2026-11-15 改口：`明明你之前给我的图是金色的，实际怎么变成了橙色`。
    // 深金（0xb45309）乘在那张近白贴图上就是橙，换成亮金：核心发白、边缘偏金，才是金色。
    gold: { fill: 0xffd24a, fillAlpha: 0.6, glow: 0xffc247, glowAlpha: 0.7, useAdditive: false },
};

/** Palette for a level's tone; anything unknown falls back to the bright one. */
export function tokenPillarPalette(tone: TokenPillarTone | undefined): TokenPillarPalette {
    return TOKEN_PILLAR_PALETTES[tone ?? 'bright'] ?? TOKEN_PILLAR_PALETTES.bright;
}

// ─── Drops: full restore ───────────────────────────────────────────────────
/** Delta handed to `heal()` for a `full-restore` drop. `heal` clamps to
 *  [0, max] (character.ts), so any value above the largest possible pool is a
 *  complete refill - the drop logic never needs to read the character's maxima.
 *  Only has to exceed the biggest HP/SP any character has (currently 115/95). */
export const DROP_FULL_RESTORE_AMOUNT = 9999;

// ─── Skill: headgear (Seed) ────────────────────────────────────────────

/** Additive tint that shows the mascot headgear is worn. A warm mascot gold,
 *  deliberately unlike the crimson hurt flash and the cyan dodge trail. */
export const HEADGEAR_DEFAULT_TINT = 0xffe9a8;

/**
 * Where along a character's drawn height the held weapon sits, measured from the
 * feet up.
 *
 * 0.5 landed at the chest, which reads wrong: her arms hang, so a gun held at chest
 * height looks strapped on. 0.44 sits it at the belt line - where a hand that is not
 * raised actually is. See `handUpOffset`.
 */
export const HAND_HEIGHT_RATIO = 0.44;

// ─── Tint modes (Phaser 4 `Phaser.TintModes`) ──────────────────────────────
// Copied as numbers so `lib/` stays engine-free. Verified against
// node_modules/phaser/src/renderer/TintModes.js: MULTIPLY 0, FILL 1, ADD 2.
export const TINT_MODE_MULTIPLY = 0;
/** Replaces the texture colour with the tint. A white-out, not a highlight. */
export const TINT_MODE_FILL = 1;
/** Adds the tint on top of the texture. Saturates bright art to white. */
export const TINT_MODE_ADD = 2;

// ─── Blend modes (Phaser 4 `Phaser.BlendModes`) ────────────────────────────
// Same reasoning as the tint modes above: numbers, so a module can set a blend mode without
// importing the engine. That import is what broke the phone on 2026-11-15 — `token-beam.ts`
// read `Phaser.BlendModes.ADD` with no import, `tsc` was happy (Phaser is a global namespace
// type), and at runtime the delayedCall that spawns a boss drop threw `Phaser is not defined`,
// which killed Phaser's RAF chain and froze the canvas (owner: `打死卷轴关的boss必卡死`).
// Verified against node_modules/phaser/src/renderer/BlendModes.js: NORMAL 0, ADD 1.
export const BLEND_MODE_NORMAL = 0;
/** Additive: overlapping bright pixels add up, which is what makes a light column glow. */
export const BLEND_MODE_ADD = 1;

// ─── Character: locomotion (sprint) ────────────────────────────────────

/**
 * Speed multiplier while the sprint key (`KEY_SHIFT`) is held. 1 disables the
 * sprint outright. Sprinting is deliberately free — no SP cost — so it reads as
 * a way to cross the map rather than a second dodge; raise this to make it
 * matter more, or move the cost into the character's SP if it should.
 */
export const CHARACTER_SPRINT_MULTIPLIER = 1.4;

// ─── Combat: contact damage rate-limit (player) ────────────────────────

/** Minimum gap between consecutive damage events to the player. Prevents
 *  brush-by contact from stacking to death in a single frame. */
export const COMBAT_PLAYER_DAMAGE_COOLDOWN_MS = 100;

/** Global scale factor applied to per-character crit chance.
 *  critChance = (luck / 10) * COMBAT_CRIT_MULTIPLIER
 *  At 0.5: luck=10 → 50 %, luck=5 → 25 %, luck=1 → 5 %.
 *  Tune this to adjust overall crit frequency without
 *  touching individual character YAML files. */
export const COMBAT_CRIT_MULTIPLIER = 1.0;

/**
 * Flat damage soaked per armour level: L1 soaks 5, L5 soaks 25.
 *
 * Flat rather than a percentage on purpose - a percentage would blunt a boss's
 * ultimate, and the owner wants those to still land like a truck.
 */
export const ARMOR_PER_LEVEL = 5;

/** Skill growth per tavern upgrade level. */
/**
 * How much of 龙吟's HP share a **boss** loses, relative to a normal monster.
 *
 * The roar takes `hpFraction` of MAX HP (0.5 = half). On a boss that share is cut again, so one
 * roar takes a quarter of her bar instead of half (`小怪扣一半，boss扣1/4`, owner, 2026-11-14).
 */
/**
 * 顶部短句提示的字号，px（`NoticeToast`）。
 *
 * 15 -> 21，主人 2026-11-14：`把所有的这种提示字体都给加大3个字号（补血补蓝、冰镇果汁、
 * 天空之城王座的触发词、白米饭饭盆触发词等）`。这一条管着所有走 `showNotice` 的话——
 * 补血补蓝、果汁台词、王座与饭盆的彩蛋、背包满之类，全部同一处。
 *
 * 21 -> 27，主人 2026-11-17：`冰镇果汁，好喝，哇GPT藏起来的……这些字号统一增大3个字号，
 * 包括手机端的也要增大`。一次加 3 个字号 = 6px（沿用上一次 1 个字号 2px 的换算法）。
 * 双端共用一个常量，所以手机端跟着一起变大，不需要另开一份。
 */
export const NOTICE_FONT_PX = 27;

export const ROAR_BOSS_DAMAGE_MULTIPLIER = 0.5;

export const SKILL_SP_COST_PER_LEVEL = 10;
export const SKILL_CD_REDUCTION_PER_LEVEL_MS = 2000;
/** Cooldown floor: a -2s/level cut would otherwise make a short skill spam. */
export const SKILL_MIN_COOLDOWN_MS = 500;

/** Damage multiplier applied when a hit is a critical strike.
 *  finalDamage = baseDamage * COMBAT_CRIT_DAMAGE_MULTIPLIER.
 *  Default 2 = double damage on crit. */
export const COMBAT_CRIT_DAMAGE_MULTIPLIER = 2;

/** How long a monster's death animation lingers in a fade-out tween
 *  before the body is destroyed and dropped items are released.
 *  Long enough for the player to register the kill, short enough to
 *  not stall combat flow. */
export const MONSTER_DEATH_FADE_MS = 800;

// ─── Combat: Hit feedback & Juice ──────────────────────────────────────

/** Hit flash duration in milliseconds. Monster sprite turns solid white. */
export const COMBAT_HIT_FLASH_MS = 80;

/** Player character hurt flash duration in milliseconds. Flashes danger crimson red. */
export const CHARACTER_HURT_FLASH_MS = 100;

/** Short hit-stun duration where monster chase movement pauses to allow knockback. */
export const COMBAT_HIT_STUN_MS = 80;

/** Base impulse multiplier for bullet knockback calculation. */
export const COMBAT_KNOCKBACK_BASE_MULT = 0.35;

/** Max knockback velocity cap. */
export const COMBAT_KNOCKBACK_MAX_SPEED = 2.2;

/** Screen shake on critical hits (duration ms, intensity). */
export const COMBAT_SCREEN_SHAKE_CRIT = { duration: 60, intensity: 0.003 };

/** Screen shake on heavy explosive impacts. */
export const COMBAT_SCREEN_SHAKE_EXPLOSION = { duration: 100, intensity: 0.005 };

// ─── Render: shared visual constants ──────────────────────────────────

/** Max trail positions kept per bullet for the bullet trail. */
export const RENDER_BULLET_TRAIL_LENGTH = 6;

/**
 * The camera's viewport, in world pixels — the game's native resolution.
 *
 * Deliberately NOT the level's `imageSize`. The canvas stays this size while
 * the world is free to be larger, so the camera scrolls across a big map
 * instead of trying to squeeze the whole thing onto one screen. A level that
 * is exactly this size (every level so far) behaves as it always has: the
 * camera bounds equal the view, so it holds a single centered shot.
 */
export const RENDER_VIEW_WIDTH = 2752;
export const RENDER_VIEW_HEIGHT = 1536;

/** Camera follow smoothing per axis: 0 snaps, higher is looser. */
export const RENDER_CAMERA_LERP = 0.12;

// ─── Tavern: actor visual scale ────────────────────────────────────────

/**
 * Visual scale multiplier for every actor standing in the tavern.
 *
 * The seaside-pavilion background is drawn at a much larger architectural
 * scale than the character sheets: a deck plank measures ~50px and a sake
 * bottle ~30px, which implies a human roughly 500px tall. At 1:1 the
 * sheets' 130-200px characters fit four planks and read as dolls on a
 * stage. 1.8 closes most of the gap. The beach keeps 1:1, because *its*
 * palms imply the sheets' own scale, and the level transition is a 400ms
 * camera fade, so the change in apparent size is never seen.
 *
 * Applies to both the selection NPCs and the player (see scene.ts) — a
 * player who snapped back to 1:1 the moment she was picked would be
 * jarring. Purely visual: bodies, hitboxes and gameplay stay on the
 * sheet's authored scale.
 */
export const TAVERN_ACTOR_SCALE = 1.8;

// ─── Teleporters ───────────────────────────────────────────────────────

/**
 * Trigger radius for every portal on a 2x2 level, in world pixels.
 *
 * The owner unbundled the 4x4 worlds into single 5504x3072 tiles and then asked for one
 * number everywhere: `以后只要是2*2的图把传送阵半径都设置为200`. A 400px-wide trigger sits
 * comfortably inside the painted magic circle without reaching the walls around it, and one
 * constant means a new 2x2 level cannot quietly pick a different feel.
 *
 * The 4x4 maps keep their own values (sky city and Atlantis use 300); the small rooms
 * (tavern, dev cabin, hidden map) keep their hand-tuned ones.
 */
export const TELEPORTER_RADIUS_2X2_PX = 200;

/**
 * Trigger radius for every portal on a 4x4-or-bigger level, in world pixels.
 *
 * The owner set this in the same breath as the 2x2 number:
 * `4*4以上的图（包括4*4）半径都设置300`. Why the big maps need the wider trigger: the
 * camera shows a fixed 2752x1536 window, so a 4x4 world is four screens wide and the
 * painted magic circle on the art is correspondingly larger - a 200px trigger would sit
 * inside the circle and feel like it has to be hit dead centre.
 */
export const TELEPORTER_RADIUS_4X4_PX = 300;

/**
 * Levels at this image size are the 2x2 ones - one painted tile per level.
 */
export const LEVEL_SIZE_2X2 = { width: 5504, height: 3072 } as const;

/**
 * One painted tile. A level's tile count is `imageSize / this`, which is what decides
 * its portal radius: 2x2 tiles -> 200, 4x4 or more -> 300.
 */
export const LEVEL_TILE_SIZE = { width: 2752, height: 1536 } as const;

// ─── Merchant: the hub keeper at the junction ──────────────────────────

/** Texture key the scene loads the merchant art under. */
export const MERCHANT_TEXTURE_KEY = 'merchant-portrait';

/** Path under `public/` to the merchant art (a 355x770 vertical sticker). */
export const MERCHANT_TEXTURE_PATH = 'assets/image/npcs/merchant.png';

/**
 * On-screen height in world pixels.
 *
 * The sheet characters stand ~128-200px; the tavern scales them 1.8x. 300
 * puts her a head above the player at 1:1, which is what makes her read as
 * a landmark rather than a dropped item — she is the only thing standing at
 * the junction of four screens.
 */
export const MERCHANT_DISPLAY_HEIGHT = 300;

// ─── Audio: EventBus event-name helpers ─────────────────────────────────
//
// AudioController subscribes to these. Other modules emit them; nobody
// imports the audio module directly. Naming follows `sfx:<id>` /
// `music:<id>` so the event name is a 1:1 map from the YAML id.

export const SFX_EVENT = (id: string): string => `sfx:${id}`;
export const SFX_STOP = (id: string): string => `sfx:stop:${id}`;
export const MUSIC_EVENT = (id: string): string => `music:${id}`;
export const MUSIC_STOP = 'music:stop';
export const MUSIC_PAUSE = 'music:pause';
export const MUSIC_RESUME = 'music:resume';

/** Default cross-fade when a music stop / switch lacks an explicit fadeOut. */
export const AUDIO_DEFAULT_FADE_MS = 250;

// ─── Saves: hotkeys & feedback ──────────────────────────────────────
/** Quick save. F5 rather than Ctrl+S: the browser owns Ctrl+S. */
export const KEY_QUICK_LOAD = 120; // F9
/** Transient line shown after a save / load / import. */
export const SAVE_TOAST_EVENT = 'save:toast';
/** How long that line stays up. */
export const SAVE_TOAST_MS = 2200;

// ─── Aim: Directional (no magnetism) ────────────────────────────────
/**
 * How far out along an eight-way direction the aim point is placed.
 *
 * Only needs to be further than any weapon's range: weapons shoot along the
 * direction from the hands to this point, so the number itself never caps a shot.
 */
export const AIM_DIRECTIONAL_RANGE = 600;

// ─── Drops: Parabolic Arc & Magnet Absorption Constants ─────────────────
export const DROP_CONFIG = {
    /** Whether to play sprite animations (false = display static frame 0). */
    ENABLE_ANIMATION: false,

    /** Parabolic arc jump configuration for dropped items */
    PARABOLA: {
        /** Arc animation duration in ms */
        DURATION: 450,
        /** Minimum random offset horizontal jump distance (px) */
        POP_RADIUS_MIN: 24,
        /** Maximum random offset horizontal jump distance (px) */
        POP_RADIUS_MAX: 48,
        /** Arc height peak offset (px) */
        ARC_HEIGHT: 32,
        /** Parabola trajectory line stroke color (gray) */
        LINE_COLOR: 0x9ca3af,
        /** Parabola trajectory line alpha */
        LINE_ALPHA: 0.4,
        /** Parabola trajectory line width (px) */
        LINE_WIDTH: 1.5,
    },

    /** Magnet attraction configuration when character gets near drops */
    MAGNET: {
        /** Attraction sensing radius around character (px) */
        RADIUS: 120,
        /** Lerp speed factor for flying towards character (0 ~ 1) */
        FLY_SPEED: 0.18,
        /** Minimum distance to trigger actual pickup (px) */
        PICKUP_DISTANCE: 16,
    },

    /** Ground-display scale multiplier for weapon-pickup drops. The
     *  weapon's `visual.scale` (e.g. 0.16 for arcana-staff) is sized
     *  for the in-hand sprite anchored to a character body. On the
     *  ground the drop is its own prop, so we bump it by this factor
     *  for legibility. Hand-tuned — change here if a weapon ends up
     *  too tiny / too big on the tavern floor. */
    WEAPON_PICKUP_SCALE_MULTIPLIER: 1,
} as const;

// ─── Graphics: Pixel Art Engine Lighting & Camera Filter Config ────────
export const PIXEL_LIGHTING_CONFIG = {
    /** Global toggle for pixel art engine lighting and camera filters. */
    ENABLE: true,

    /** Environment background tint when pixel lighting is active (soft ambient twilight). */
    BACKGROUND_TINT: 0x6c7c8c,

    /** PointLight warm amber color (torch light). */
    LIGHT_COLOR: 0xe8d5b0,
    /** PointLight horizontal radius (px). */
    LIGHT_RADIUS_X: 200,
    /** PointLight vertical radius matching 2.5D body perspective (200 * 24 / 28 ≈ 171px). */
    LIGHT_RADIUS_Y: 171,
    /** PointLight intensity (0.0 ~ 1.0). Very subtle mist glow. */
    LIGHT_INTENSITY: 0.1,
    /** PointLight edge attenuation factor (smooth natural diffusion without rings). */
    LIGHT_ATTENUATION: 0.05,

    /** Camera Pixelate filter amount (0 = off). */
    PIXELATE_AMOUNT: 0,

    /** Enable color quantization filter (false = smooth natural light diffusion without step rings). */
    USE_QUANTIZE: true,
    /** Camera Quantize filter step array per channel [R, G, B, A]. */
    QUANTIZE_STEPS: [32, 32, 32, 1],
    /** Whether to enable Bayer matrix ordered dithering. */
    QUANTIZE_DITHER: false,
} as const;

export { BOOT_LOADING } from '@/lib/boot-loading/config';

// ─── Boss phases ─────────────────────────────────────────────────────────
/** Invulnerable beat while a boss climbs the ladder. Long enough to read the new
 *  form, short enough that it never feels like a pause. */
export const BOSS_PHASE_TRANSITION_MS = 2000;

// ─── Weapons: reload ─────────────────────────────────────────────────────
/** How long after a completed reload auto-reload may fire again. Long enough to let
 *  the "Full" flash read, short enough that an empty magazine re-arms itself. */
export const RELOAD_AUTO_REARM_MS = 400;

// ─── Weapons: store → live controller ────────────────────────────────────
/**
 * The store owns the numbers the shop sells; the live `WeaponController` owns the
 * guns in her hands. These two used to sync only on the next scene load, so buying
 * ammo or an upgrade changed the card and nothing else.
 */
export const WEAPONS_REFILL_ALL_EVENT = 'weapons:refill-all';
export const WEAPONS_REFILL_ONE_EVENT = 'weapons:refill-one';

/**
 * A shop ladder level just changed: `{ upgradeId, from, to }`.
 *
 * The live character listens: buying spirit has to raise her HP/SP caps on the spot, not
 * after the next scene load.
 */
export const UPGRADE_LEVEL_EVENT = 'upgrades:level';

// ─── Walk bob ────────────────────────────────────────────────────────────
/**
 * How far her body rises and falls while walking, in px.
 *
 * The dress characters' walk frames barely differ (DeepSeek's stride is 8.5 in the leg band
 * versus GPT's 31), so their cycle reads as a slide. Two pixels of bounce is enough to read
 * as steps without looking like hopping - and it is applied to the sprite only, never to the
 * physics body.
 */
export const WALK_BOB_PX = 2;

/** Bounces per second. Tuned to the 10fps, 4-frame walk cycle. */
export const WALK_BOB_HZ = 2.4;

// ─── Mobile auto-reload ─────────────────────────────────────────────────
/**
 * How long the player may go without firing, taking a hit or casting before the magazine
 * fills itself. The owner: `换弹功能在移动端做成自动化，脱战5s自动换弹`.
 *
 * Lives here rather than in the module because it is a tuning knob the scene reads and a
 * future balance pass will change without touching logic.
 */
export const MOBILE_AUTO_RELOAD_IDLE_MS = 5000;

// ─── Backpack ───────────────────────────────────────────────────────────
/**
 * Ask the backpack to open or close.
 *
 * The touch chip cannot call `setBackpackOpen` directly: the overlay also pauses the scene and
 * the music, and two code paths that each half-own that would drift. The chip emits this, the
 * overlay toggles.
 */
export const BACKPACK_TOGGLE_EVENT = 'backpack:toggle';

// ─── 创世线（Epilogue） ────────────────────────────────────────────────────
/**
 * seed opens her own shop.
 *
 * Same bus pattern as the mysterious merchant's `MERCHANT_SHOP_EVENT`: the NPC (posed in the
 * pavilion) emits, the React panel listens. The two shops are separate panels because their
 * contents have nothing in common - one sells upgrades, the other hands out destinations.
 */
export const SEED_SHOP_EVENT = 'seed:shop';

// ─── 过场视频（Story videos） ──────────────────────────────────────────────
/**
 * Play a cut-scene video, full screen.
 *
 * Payload: `{ src }` - a path under `public/`. The player in `components/hud/story-video.tsx`
 * owns pausing the scene and the BGM, because a video that plays over a live game looks like a
 * bug (`播放时 BGM 取消，用视频原声`).
 */
export const PLAY_STORY_VIDEO_EVENT = 'story:video:play';

/** The video ended, or the player skipped it. Payload: none. */
export const STORY_VIDEO_DONE_EVENT = 'story:video:done';
