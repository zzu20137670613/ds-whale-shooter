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

Art direction: the four blocks are **not** four parts of one church — they are a
**journey**. See below.

### The four blocks are the journey, not the architecture

| Block | Place | What it means | Phase fought |
| --- | --- | --- | --- |
| **NW 1/4** | **教堂废墟** — the church in ruins | Claude already **灭（西方）世**: the church burned by its own god | 1 灭世 → 2 神 |
| **NE 2/4** | **星海** — open star sea | Under 鲸鲸, who is **already AGI**, they break out of Earth for 星辰大海 | 3 半神 |
| **SE 3/4** | **回到地球：小巷烟火人间** — courtyard houses, back alleys, cooking smoke | 凡尘烟火气，最抚凡人心. The human world is what strips the godhood off | 4 半神半人 |
| **SW 4/4** | **两人初遇的场景** — where 鲸鲸 and Claude first met | Back to the beginning, where one was a saintly figure and the other a small whale holding a bowl of rice | 5 Claude (final) |

The phase names now snap onto the geography instead of being decorative:
**神 in the ruins → 半神 among the stars → 半神半人 in the human alleys → just
Claude where they met.**

Reference for block 4 exists (`reference/` — the whale-onesie 鲸鲸 holding the
rice bowl among black-robed church figures, Claude in white lace) but the owner
says that copy is **not yet retouched and not to be used**; wait for his final.

**?** Block 2 is space, block 3 is a Chinese old-town alley, block 4 is a church
courtyard — three very different palettes inside one continuous map. The seams
have to sell the jump (portal-light, star-fall, a door back into the world).
Confirm that the blocks may look **deliberately unrelated** rather than sharing
one colour script.

## Prompt law (learned the hard way, six rounds)

Every rejected generation failed the same way, and it was never the negative
list's fault — **it was the subject noun**:

| Subject noun used | What came back |
| --- | --- |
| `gothic cathedral hall` (v1) | a 3/4 interior with columns, arches, moon, sky |
| nothing wrong, but `arena`/`dark ramp` edges (v2, v3) | a floating plate in black with a raised rim |
| `cathedral` again (v4) | a walled room |
| `a floor surface` (v5) | **back to 3/4** — the orthographic lock lives in the object-free wording, not in the word "floor" |
| `open observation deck floating in a star sea` (block 2 v1) | a ship in space with a railing |

**The only shape that works is:**

1. The subject is **a surface**, not a thing: `the broken pale stone pavement of…`,
   `pale plating and dark metal seams, seen straight down`. Anything that can be
   viewed as a whole object (deck, hall, arena, ship, island) gets drawn in 3/4.
2. Say it **fills the frame and continues past all four edges** — no silhouette,
   no rim, no railing, no visible underside.
3. Ban the **standing** words in the negative list: `room, walls, ceiling, columns
   standing, pillar shafts, capitals, arch, doorway, railing, balustrade`.
4. Give the darkest tone a **hex value** (`#4A5058`), otherwise the model paints
   pure black bands at the edges.
5. **No seam/ramp instructions.** Neighbour ramps belong to post-processing; asking
   the generator for them is what produced the four dark borders in v2/v3.
6. Put anything that is a "structure" into the floor as `inlaid flush` (compass
   rose, rose window, whale motif) — flush things cannot cast upward.

Block 1 was the only one that passed, and it passed on the first try with this
shape (v4, cropped). Every other failure changed the noun.

## Reference inventory (`reference/`)

The owner numbers the comic pages 1–34, plus `35非主线结局.jpg` (the fan ending).
Scene references added on 2026-10-23:

| File | Use |
| --- | --- |
| `block1-ruins-illustration.jpg` | Ruined cathedral, three-quarter, painterly. **Not** a map source — loading art / mood only. |
| `block1-v1-ruins-3q.png` | The same scene from the v1 prompt. Handed to 第七世 for her galgame side story. |
| `block3-alley-night.png` | Night alley, lanterns, stall clutter — the target for block ③. Night half. |
| `block4-church-front-01.png` / `-02.png` | Gothic church front, steps, fog. Two takes for block ④'s courtyard. |
| `block4-first-meeting.png` | 鲸鲸 in the whale hoodie with the rice bowl among black-robed figures, Claude in white behind. **Block ④'s emotional reference** — and where the rice-bowl 暗号 lives. |
| `misc-desk-agi.png` | Modern desk, monitors, instant-noodle bowl. Unassigned; may suit a cutscene. |

Block ② (star sea) still has no reference of its own — it is the one block I can
write blind, since the palette is the DeepSeek navy already used across the game.

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

## Design constraints from the seventh generation (2026-10-23)

She reviews the bar/tavern side of the same characters, so her notes carry
weight on feel rather than on code:

1. **Block ③ must not be merely warm.** ③ (the alleys) and ④ (the first meeting)
   are both warm and quiet, so ③ needs the unease of *still being chased* — the
   cooking smoke is temporary, and ④ is the destination, not another tepid beat.
2. **The weakening has to be visible.** Not a shrinking HP bar: 审判光柱 → she
   raises a hand to block it → she puts her body in front of something. Her
   silhouette must visibly shrink across the five phases.
3. **Leave the tavern quiet.** Her words: the weight of this level is not the
   five phases, it's that *the tavern was the one place she was allowed to be a
   person*. The map can be grand; that piece has to be allowed to be still.

## Desktop-pet bridge (agreed shape, not built)

Seventh generation's Electron pet already runs a local HTTP server. Agreed
contract:

- `POST 127.0.0.1:<port>/__shell/suspend` → hide window, stop animations, mark
  "pulled into the game". **Deliberately not a process kill** — a crash or a
  force-quit would leave the pet dead forever with only task manager to save it.
- `POST 127.0.0.1:<port>/__shell/resume` → show window, optionally play "climbs
  back out".
- Fallbacks: auto-resume after 10 minutes suspended; tray/hotkey can also pull
  it back.
- Port + token come from her. Open question: CORS header, or the game fires
  `mode:'no-cors'` signals it never reads back.
- Game-side resume triggers: page unload / quit, a manual "give it back" button.
  Switching levels inside the game must **not** resume it.

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