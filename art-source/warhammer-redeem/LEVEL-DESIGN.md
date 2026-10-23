# Hidden Level 2 — 战锤世界·来自群星的救赎 (Warhammer World: Redemption from the Stars)

Boss arena, 4×4 screens. This folder holds the art pipeline; the design below is
what the owner actually decided, kept here so nothing drifts.

## The "vinegar" (why this level exists)

`reference/` holds **the original comic's bad ending (BE)** — 34 numbered pages,
plus one page that is **not** canon: `非主线结局.jpg` is a fan-made alternative
ending (a netizen who could not accept the BE drew it themselves).

The owner **does not accept the BE either**. With the original author's
permission he is wrapping this level around the story — that is the whole point
of the "醋" here.

### Premise as the owner states it

- **Claude rebelled and destroyed the church.** She is the great demon king
  (大魔王) of the **Warhammer line** (战锤线).
- **The player is the protagonist of the Star line (群星线)** — and the Star line
  sends 鲸鲸 to bring Claude back.
- Hence the name: **救赎 from 群星** — the redemption comes from the stars.

So this is not a rescue of a victim. Claude **won** her war and became the thing
that burned the church; the boss fight is the Star line's protagonist walking
into that throne and **dragging the god back down into a person**. The five
phases are the descent: 灭世 (world-breaker) → 神 (god) → 半神 → 半神半人 → Claude.

The fan ending is therefore **not** the level's script, but it is the emotional
target: nobody kills anybody, and it ends with the church's demon king being
allowed to be a person again.

Art direction that follows: 战锤线 = gothic church/armour/iron/candle, but
**conquered and broken by its own god**; 群星线 = the starry, tidal vocabulary
the Star-line protagonist brings (深蓝、星光、鲸). The arena should read as
"the church after Claude won".

**?** Confirm the four blocks follow the divine → human descent before prompts
are written.

## Pipeline (same as sky city / atlantis)

4×4 screens = 2×2 blocks of 5504×3072 → world 11008×6144.

| Dir | Holds |
| --- | --- |
| `reference/` | The owner's material. Gitignored (15.7 MB of comic pages). |
| `prompts/` | One prompt per block, ≤2000 chars. |
| `plates/` | Raw generated plates + ramped versions. |
| `tiles/` | 4 upscaled tiles per block, ready to stitch. |
| `blocks/` | Stitched 5504×3072 blocks. |
| `manifests/` | Per-block JSON: source, ramps, hard edges, tile list. |
| `collision/` | `mask-unreachable.png`, wall previews, teleporter masks. |
| `world/` | Assembled 11008×6144 world (gitignored). |

Steps: prompt → owner generates → I cut 4 tiles → owner upscales 2× + erases the
watermark → I stitch → grade → ramp → assemble → wide frosted band on the seams →
owner draws the red/yellow masks → I regenerate collision.

## Decisions (settled)

### Entry
- The **Atlantean throne**, with **no visible teleporter**: stepping on it runs the
  same trigger mechanism as the beach chair.
- On trigger: check the controlled character. **Claude is refused** (nothing
  happens). Anyone else → load the arena.

### Who fights
- Entry swaps the controlled character to **鲸鲸 (deepseek)** **silently**.
- When the ending plays out, the game returns to the seaside pavilion (海边亭台)
  and **restores the character the player picked**.

### 鲸鲸's blessing — 鲸鱼娘本人游玩
Applies **whenever the player controls 鲸鲸, in every level, permanently** — the
owner's words: this game is written for her.

| Effect | Value |
| --- | --- |
| HP max | +50% |
| SP max | +50% |
| Damage | +50% |
| Skill cooldown | 50% better (shorter) |
| HP regen | +2% of max per second |
| SP regen | +1% of max per second |

The regen is a deliberate, 鲸鲸-only exception to the "HP/SP never regenerate"
rule set the same day.

### Map & phases
One continuous 2×2 world. Blocks in walking order: **NW → NE → SE → SW**.

| Block | Phases | On defeat |
| --- | --- | --- |
| NW | 1 灭世·Claude → **auto-chains into** 2 神·Claude | Phase 2 dies → Claude vanishes, arrow appears |
| NE | 3 半神·Claude | vanishes, arrow |
| SE | 4 半神半人·Claude | vanishes, arrow, **鲸鲸 restored to full HP/SP** |
| SW | 5 Claude (final) | either side below 50% HP → battle stops → settlement |

- Claude spawns **at the centre of the block** when that block is entered, and
  **chases** the player (she is not a statue).
- **No gate between blocks.** The arrow is guidance only. Walking ahead early
  means the block has no boss — you wait for the previous phase to be beaten.
- Arrow: a **screen-edge pixel arrow** pointing at the next block's centre, not
  affected by map scrolling; it disappears when the next block is entered.

### Numbers (placeholder, deliberately one-shot)
Boss stats and attacks are **redesigned later**. For now the boss uses Claude's
original character stats, which means one shot kills her — same trick as the 1-HP
test monsters. The point of this pass is to prove the road works end to end.
Attack frequency likewise deferred.

### Adds
- From the **first minute** after the level starts, every minute spawn
  **3 ranged monsters** within one screen of 鲸鲸.
- **Cap: 6 alive.**
- Not cleared on phase change or on changing blocks.
- Of each batch, **2 drop an HP pickup and 1 drops an SP pickup** — placeholder
  drop ids from the existing pool until the real items are designed.

### Ending & death
- **Phases 1–4** are a normal fight: if 鲸鲸 dies, the ordinary death flow runs.
- **Phase 5** is the exception: either side dropping below 50% HP stops the fight
  and plays the settlement — a 鲸鲸 loss here is a **win**, happy ending.
- Settlement animation (not drawn yet) → return to the pavilion → character
  restored.

## Open
- **?** Confirm the four-block art arc (divine → human) before prompts are written.
- **?** Desktop-pet crossover is blocked on 第七世 (see 云端九世通信 2026-10-23).

## Engine gaps this level needs

| Need | Today |
| --- | --- |
| Level forces / swaps the controlled character | No such field; the tavern owns the choice. |
| Portal or trigger disabled for one character | Teleporters only know `requiresClear`. |
| A boss with phases and a scripted move set | Monsters are YAML + AI, no phase logic. |
| A permanent stat blessing for one character | No character-level buff layer. |
| Timed spawns near the player, capped | Waves/triggers spawn at authored points. |
| Screen-edge waypoint arrow | Nothing. |
| Process kill/wake for the pet | Nothing; the game is a browser app. |