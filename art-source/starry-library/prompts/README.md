# Prompt set — one file per generated base plate

Each `.txt` here is a paste-ready prompt: it produced exactly one plate in `../plates/`.
The prompts are the generation half of the recipe, the same way `../manifests/` is the
cutting half. They are archived because a plate is only reproducible with its prompt.

## The two versions

| Set  | Files | Grid            | Status                                                                                                                                       |
| ---- | ----- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1` | 4     | 3×3 nine blocks | Superseded. The nine-block assembly was abandoned — see below.                                                                                |
| `v2` | 9     | 3×3 nine blocks | Superseded by the four-block set that shipped, but kept: it is the version that introduced the gradient-per-edge rule and the frosted-glass band. |

The shipped world uses **four** plates, one per room. Those prompts were written in the same
series and live in the working pack (Chinese notes) rather than here.

## The rule these prompts exist to carry

Every edge of a plate that will touch a neighbouring plate has to carry a gradient **in the
prompt**, because the model will not agree with its neighbour about a hard edge. Edges on the
world's outer rim stay hard. Gradients per block by grid position:

| Position in the grid | Gradient edges |
| -------------------- | -------------- |
| Corner               | 2              |
| Edge middle          | 3              |
| Centre               | 4              |

Seams needed: `2 × n × (n − 1)` for `n` blocks per side — 4 at 2×2, 12 at 3×3, 24 at 4×4.

With the gradients in the prompt, the stitch needs only frosted glass over each seam: a 40-px
strip, r16 blur, band ±48 px (= 3 × the blur radius), 16-px feather. The band must stay near
3× the radius — an early 240-px band at r16 was 15× and smeared 12% of the map.

## Why the nine-block set was dropped

Nine independently painted blocks cannot form one continuous space: wood-grain rhythm, light
direction and palette differ per block, and no post-processing hides it. The verdict on the
assembled 6×6 was "nine different pictures forced together". Four corners-only blocks keep
every hard edge on the four block seams and let each room be a single pure style, which is why
4×4 is the ship-able size.

Full write-up (Chinese working notes): `whale-shooter/art-experiment/MULTIBLOCK-MAP-PIPELINE.md`.