# DROPS

Pickup items — hp shards, ammo caches, weapons, etc. Two kinds: `static` (level-placed) and `monster` (rolled on death, see [`MONSTERS.md`](./MONSTERS.md)).

## File layout

```
src/lib/drops/
├── schema.ts      # DropSpecSchema, discriminated DropEffectSchema, DropVisualSchema
├── types.ts       # z.infer'd types
├── parser.ts      # parseDropYaml(text, id)
├── loader.ts      # fetchDrop(id) via handle-fetch
├── prefetch.ts    # collect drop ids referenced by a level
└── index.ts       # public barrel

src/game/drops/
├── drop.ts        # DropInstance + DropController
└── logic.ts       # planDropEffect (pure applier)

public/data/drops/
├── index.yaml
├── hp-shard.yaml
├── sp-fragment.yaml
├── ammo-cache.yaml
├── overcharge-core.yaml
└── weapon-drop.yaml
```

## YAML schema — `public/data/drops/<id>.yaml`

```yaml
id: hp-shard # optional; loader overwrites with filename
name: HP Shard
kind:
    static # 'static' | 'monster'
    # static: placed in level; monster: rolled on death

visual: # procedural draw — no sprite sheet required
    size: 18 # rectangle width/height in pixels
    tint: 0x22c55e # 24-bit color (Phaser numeric)

effect: # exactly one of three discriminated variants
    type: instant # 'instant' | 'refill-ammo' | 'weapon'
    hp: 25 # instant: amount to add (defaults to 0)
    sp: 0 # instant: amount to add (defaults to 0)
    # OR:
    # type: refill-ammo
    # ammoFraction: 0.5   # 0..1 of active weapon's clip
    # OR:
    # type: weapon
    # weaponId: plasma-sword  # overridden per dropSpawn for generic weapon-drop

sfx: pickup-hp # SFX id to play on pickup; falls back to 'pickup-generic'
throttleMs: 200 # min gap between pickup SFX plays for this drop id

sprite: # optional; if present, overrides the procedural visual
    texture: assets/image/drops/drops.png
    grid: { rows: 4, cols: 4 }
    scale: 1
    offset: { left: 0, bottom: 0 }
    script:
        downsample: 4
        colors: 32
        pad: 2

anims:
    idle: { frames: [0, 3], frameRate: 6, repeat: -1 }

prompt: | # AI sprite template (rarely needed; most drops reuse textures)
    …
```

`visual.size` + `visual.tint` is the procedural fallback used when the
drop has no `sprite` block. With a sprite sheet, the controller draws
from the sheet and ignores `visual`.

## The `weapon-drop` shape

The pavilion uses a single `weapon-drop` drop spec to spawn every weapon in
the game. The level YAML carries the actual weapon id per `dropSpawn`:

```yaml
# in public/data/drops/weapon-drop.yaml
effect:
    type: weapon
    weaponId: placeholder # overridden by dropSpawn.weaponId at spawn time

# in public/data/levels/tavern.yaml → dropSpawns:
dropSpawns:
    - type: weapon-drop
      x: 400
      y: 1100
      weaponId: assault-rifle # scene rewrites this onto the spec before pickup
```

The scene's `DropController` reads `dropSpawn.weaponId`, uses the
weapon spec's `visual.texture` for the in-hand sprite, and forwards the
id to the character on pickup. This means **one drop YAML serves every
weapon pickup** without per-weapon drop yaml files.

## Public API (`src/lib/drops/index.ts`)

```ts
import {
    parseDropIndex,
    parseDropYaml,
    fetchDrop,
    fetchDropIndex,
    type DropSpec,
    type DropIndex,
    type DropEffect,
    type DropKind,
} from '@/lib/drops';
```

## Logic

### `planDropEffect` (in `src/game/drops/logic.ts`)

Pure applier. Returns a `DropEffectResult` describing what to apply — the controller does the actual side-effects via callbacks.

```ts
planDropEffect(spec, ctx): {
    hp?: number;
    sp?: number;
    refillAmmoFraction?: number;
    grantWeaponId?: string;
}
```

- `instant` → `{ hp, sp }`
- `refill-ammo` → `{ refillAmmoFraction }`
- `weapon` → `{ grantWeaponId }`

The controller then calls `cb.onHeal`, `cb.onRefillAmmo`, `cb.onGrantWeapon` depending on the result. Keeps `logic.ts` Phaser-free for testing.

### `DropInstance` (in `src/game/drops/drop.ts`)

Single pickup object. Owns: Matter body (sensor), sprite / procedural visual, animation state. Constructed by `DropController.spawn`.

### `DropController` (in `src/game/drops/drop.ts`)

Owns the array of active drops + collision wiring. Per-frame `update()` animates them.

```ts
new DropController(scene, matter, characterBody, specMap, cb);
```

| Method                          | Purpose                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `spawn(spec, x, y, overrides?)` | create new DropInstance, add to active list. `overrides` carries `DropSpawn.weaponId` for the generic weapon-drop path. |
| `update()`                      | per-frame animation tick                                                                                                |
| `destroy()`                     | teardown all drops                                                                                                      |

Collision handler listens for `collisionstart` between a drop sensor and the character body. On overlap:

1. Compute effect via `planDropEffect`
2. Fire callbacks (`cb.onHeal`, `cb.onRefillAmmo`, `cb.onGrantWeapon`)
3. Emit `sfx:<spec.sfx>` (or `sfx:pickup-generic` fallback), throttled by `throttleMs`
4. Destroy the drop

## Events emitted

| Event                                     | When           |
| ----------------------------------------- | -------------- |
| `sfx:pickup-<id>` or `sfx:pickup-generic` | drop collected |

## Events subscribed

None — drops are passive until collision fires.

## 词元盾 (Token Shield)

The guardians' buff drop — the only drop in the game that raises a **per-character** level
instead of filling a bar.

- **Ladder, five levels.** Level `n` moves `n × 10%` of an incoming hit from HP to SP: 10 / 20 /
  30 / 40 / 50 %. It never *reduces* the total, it re-books it onto the blue bar.
- **SP must be able to pay.** `splitTokenShieldDamage` sends the whole hit to HP when the pool
  cannot cover the converted share (`蓝量不足时失效`) — half-converting would leave the player
  convinced the shield worked.
- **Applies on pickup, never enters the bag.** `appliesOnPickup()` in
  `src/lib/drops/use-check.ts` is the rule `DropController.applyEffect` asks first; without it
  the shield landed in the backpack, `addInventoryItem` returned 0, and the pickup was refused
  with the drop still lying on the ground.
- **Sixth pickup and beyond** refills HP and SP instead (`collectTokenShield`).
- **Per character.** The level lives in `tokenShieldByCharacter` (save), so swapping characters
  swaps the shield with them.
- **Sprite must be a whole 64 px frame.** `loadDropAssets` registers every drop texture as a
  64×64 spritesheet; an 88×84 file loads fine but slices into a sliver. `token-shield.png` is its
  own 64×64 file (the weapon art `rune-shield.png` is 88×84 and belongs to the warden's shield).
  `tests/lib/drops/drop-sheet-sizes.test.ts` pins this for every drop.
- **Light pillar.** A column plus a ground ellipse, so the drop reads from across the map.
  `tokenPillarTone` on the level picks the palette (`src/lib/constants.ts →
  TOKEN_PILLAR_PALETTES`): `bright` (additive, for the dark library and Atlantis plates) or
  `dark` (normal blend, for the bright Sky City plates).
- **HUD chip.** `TokenShieldBadge` sits directly under the whale-girl's pet chip, reusing its
  display logic: numbers on hover on desktop, tap-to-open on a phone.

## Auto-restore (both platforms)

When a bar runs low, the bag drinks for the player instead of leaving them to open it mid-fight.

- **Trigger** 30% or below, **target** 60%. `lib/drops/auto-restore.ts` owns both numbers
  (`AUTO_RESTORE_TRIGGER_PCT` / `AUTO_RESTORE_TARGET_PCT`).
- **Hysteresis is the point.** One 生命碎片 is +25, so the drink that fires at 30% lands around
  40% - above the trigger, below the target. A single "below 30%" test would stall there forever.
  `nextRestoreArmed` latches on at the trigger and only latches off at the target.
- **HP drinks `hp-shard`, SP drinks `sp-fragment`** and nothing else. 过载核心 / 海底特饮 heal both
  bars at once; they stay the player's call.
- **One drink per 350 ms tick**, through the same `useFromBackpack` path a click takes, so the
  effect, the sound and the "did nothing, keep it" guard cannot drift from the manual route.
- **Runs on desktop too** (`此机制给PC端也加上吧`). Before 2026-11-13 it was phone-only and HP-only
  (`lib/mobile/auto-heal.ts`, since deleted).
- **Announces itself**: `生命碎片自动使用` / `灵力碎片自动使用`. A silent auto-drink is
  indistinguishable from an item disappearing.

## Adding a new drop

1. Decide `kind: static` (level-placed) or `kind: monster` (death-roll). One yaml can serve both, but `monster` drops without a level entry simply won't spawn at level start.
2. Write `public/data/drops/<id>.yaml` matching the schema.
3. Append `<id>` to `public/data/drops/index.yaml`.
4. Reference from a level (static): `public/data/levels/<level>.yaml → dropSpawns:`.
5. **Or** add to a monster's drop table: `public/data/monsters/<id>.yaml → drops:` (each entry: `{ dropId, chance }`).

## Conventions

- **Effect is a discriminated union** — `type` is the discriminator, exactly one variant. Schema enforces this; adding a new effect kind = add a new schema variant + extend `planDropEffect`.
- **Drop position inherits from caller** — static: from `level.dropSpawns[i].x/y`. Monster: from monster's body position at death.
- **No pickup-on-overlap-by-name** — collision uses Matter sensor bodies + `collisionstart` events, not raycasts.
- **Drops don't despawn over time** — they live until picked up. Add a despawn timer only if level design demands it (not currently the case).
- **The `weapon-drop` placeholder pattern** is the only case where a drop's `effect.weaponId` is rewritten per-spawn. Every other drop is statically self-contained.
