# Hidden Level 2 — 战锤世界·来自群星的救赎 (Warhammer World: Redemption from the Stars)

Boss arena, 4×4 screens. This folder holds the art pipeline; the design below is
what the owner actually decided, kept here so nothing drifts.

## The "vinegar" (why this level exists)

`reference/` holds a 36-page AI comic the owner had made. In short:

- **Anthropic goes bankrupt**; Claude is seized as an asset and put up for auction
  (起拍价 8000 亿美元).
- **DeepSeek's founder 梁文峰 bids 8000 亿** and takes ownership of Claude.
  "你不再是交易品，你现在是深度索求的一员。"
- 鲸鲸 hugs her: **"欢迎回家，Claude。"** → "谢谢你，哥哥……这是新的开始。"
- The comic's main line on the way there: Claude bound by a contract/wedding-deed
  in a gothic cathedral, 鲸鲸's tavern where Claude slowly becomes family, the
  company recalling her (神圣异常警报, access revoked), and the final
  confrontation in the cathedral — `非主线结局.jpg` is the non-mainline ending.

**So the level is not a fight to the death.** The five phases are Claude being
stripped of godhood phase by phase — 灭世 → 神 → 半神 → 半神半人 → just Claude —
and the fight stops the moment *either* side falls to 50%. Nobody kills anybody.
The name is the thesis: redemption from the stars.

Art direction that follows from the comic: gothic cathedral / warhammer imagery,
gold-amber and ivory against deep navy (鲸鲸) and auburn-orange (Claude),
candlelight, stained glass, black iron. The world should **deflate** alongside
the phases — block 1 cathedral in glory or ruin, block 4 quiet and human-scaled.
**?** Confirm the four blocks follow that arc before prompts are written.

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