# Hidden Level 2 — 战锤世界·来自群星的救赎 (Warhammer World: Redemption from the Stars)

Working folder for the boss arena. Drop reference material ("the vinegar") into
`reference/` — that is what the whole level is being built around.

## Directory map

| Dir | Holds |
| --- | --- |
| `reference/` | **Owner's reference material.** Anything that defines the look/feel/mood. Nothing generated lives here. |
| `prompts/` | The generation prompts, one per block, ≤2000 chars each. |
| `plates/` | Raw generated plates + their ramped versions. |
| `tiles/` | The 4 upscaled tiles per block, ready to stitch. |
| `blocks/` | Stitched 5504×3072 blocks. |
| `manifests/` | Per-block JSON: source, ramps, hard edges, tile list, deviations. |
| `collision/` | `mask-unreachable.png`, wall previews, teleporter masks. |
| `world/` | Assembled 11008×6144 world + grid plate + preview (gitignored). |

## Pipeline (same as sky city / atlantis)

4×4 screens = 2×2 blocks of 5504×3072 → world 11008×6144.

1. Owner drops reference material into `reference/`.
2. I write one ≤2000-char prompt per block; owner generates.
3. Owner returns the plate; I cut 4 tiles into `tiles/` (3:2 or 16:9 source, always
   compose for a 16:9 centre crop).
4. Owner upscales each tile 2× and erases the watermark; I stitch → `blocks/`.
5. Grade → ramp → assemble → wide frosted band on the 4 block seams.
6. Owner draws the masks (walls as solid red `#F30D0D`, teleporters as solid yellow
   `#DCF410`, one file each); I regenerate collision from them.

## Design as stated by the owner (2026-10-22)

Quoted intent, not yet implemented. Open points are marked **?**.

### Placement
- Hidden level **2**; hidden level 1 is the tavern alcove (untouched).
- Hidden level **3** will be sold as an item in the mysterious merchant's shop
  (deferred).
- **No teleporter into this level for now** — and per the owner, possibly never;
  the entry mechanism is still to be explained.

### Who fights
1. Portal must be **disabled when the player picked Claude** (Claude cannot fight
   herself).
2. Anyone **except** 鲸鲸 (DeepSeek) and Claude who enters gets **auto-swapped to
   鲸鲸** on load.
   - **?** Does the swap revert when leaving?
   - **?** Is the swap a silent scene-load override (level YAML field), or a
     visible "possession" beat?

### 鲸鲸 buff — 鲸鱼娘本人游玩
Granted while the player controls 鲸鲸 (which this level forces):

- **+50% to all stats** — **?** which stats exactly: HP, SP, move speed, damage,
  fire rate, luck? "All" needs a list before it can be coded or balanced.
- **+2% max HP per second** — this deliberately contradicts the "no passive regen"
  rule from earlier today; confirm it is scoped to this level only.
- **+1% max SP per second** — same question.

### Desktop-pet crossover (not built yet)
- On game open: if a desktop pet exists on the machine, play an animation (pet
  hugs the computer, light, pet is sucked in). Real logic = kill/suspend the pet
  process.
- On game exit: wake the pet again (reverse animation, pet climbs out, collects
  the computer).
- **?** This needs capabilities a browser does not have. Options: a local bridge
  (dev-server endpoint / tiny helper app), or the pet exposes its own local HTTP
  API. Which one do we have?

### Five phases, spread across the four blocks

The arena is one continuous 2×2 world; "map 1/4" below means one block of it.
Claude is a **stationary encounter at the block's centre** — she is placed when
the block is entered, not hunted across the map.

| Block | Phases fought | On defeat |
| --- | --- | --- |
| 1 (first quarter) | 1 灭世·Claude → **auto-chains into** 2 神·Claude | After phase 1 dies, phase 2 starts **in place** (no arrow, no repositioning). After phase 2 dies, Claude **vanishes** and an **arrow** points to the next block. |
| 2 | 3 半神·Claude | Claude vanishes, arrow to block 3. |
| 3 | 4 半神半人·Claude | Claude vanishes, arrow to block 4. **鲸鲸 is fully restored** here. |
| 4 | 5 Claude (final) | Battle stops when either side drops below 50% HP → settlement animation. |

So: block 1 carries two health bars back to back; blocks 2, 3 and 4 carry one each.

- **?** Which block is "1/4" and in what order does the player walk them
  (NW → NE → SE → SW? clockwise?) — this decides where the spawn, the arrows and
  the boss centres go.
- **?** The blocks are one continuous map, so what stops the player from simply
  walking to block 2 before finishing phase 2? A locked gate that opens on the
  kill, or is the arrow purely advisory?
- **?** Does the boss stand still at the centre, or does she move/charge at 鲸鲸?
- **?** "100% attributes" — 100% of Claude's *character* stats (HP 55, SP 55)?
  As a boss that is one hit; is there a boss HP multiplier (e.g. ×40) so phase 1
  is ~2200 HP and phases 3/4 scale down from there?
- **?** Do the minute-spawned adds persist across blocks, or are they cleared when
  Claude vanishes?

### Boss fight rules
- **Adds:** every minute, spawn **3 ranged monsters** within one screen of 鲸鲸.
  Placeholder types (`sniper`, `gunner`, `keeper`) until the real adds are designed.
  - **?** Do adds despawn on phase change? Is there a cap on how many can be alive?
- **Five phases of Claude:**

| # | Name | Stats | Attack frequency | Attack pattern |
| --- | --- | --- | --- | --- |
| 1 | 灭世·Claude | 100% (original Claude) | baseline | TBD (placeholder: original) |
| 2 | 神·Claude | +20% all stats | **+50%** | TBD |
| 3 | 半神·Claude | 80% | back to baseline | TBD |
| 4 | 半神半人·Claude | 50% | baseline | TBD |
| 5 | Claude (final) | back to original | **low** | original |

  - **?** On phase 4 defeat the owner says 鲸鲸 is fully restored ("全属性回满") —
    HP + SP only, or literally every stat?
  - **?** Phase 5 ends when **either** side drops below 50% HP. Both directions
    are "player wins" (settlement animation), so a 鲸鲸 loss is not a death —
    confirm no death overlay fires in this level.

### Ending
- Settlement animation is not drawn yet. **?** What follows it — return to the
  tavern, a cutscene scene, or the victory overlay?

## Engine gaps this level needs (for later, not now)

| Need | Today |
| --- | --- |
| Level forces the controlled character | No such field; the tavern owns character choice. |
| Portal disabled for specific characters | Teleporters only know `requiresClear`. |
| A boss with phases and a scripted move set | Monsters are YAML + AI, no phase logic. |
| Per-level stat buffs | Skills buff the player; there is no level-scope buff layer. |
| Timed spawns near the player | Waves/triggers spawn at authored points. |
| Process kill/wake for the pet | Nothing; the game is a browser app. |