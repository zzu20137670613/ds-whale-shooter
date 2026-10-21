# S2 Sky City — a 4x4 screen world in four blocks

Four panels, each 2x2 screens (5504x3072), placed as:

| Block | Position | Content | Graded edges | Hard edges |
| --- | --- | --- | --- | --- |
| A | SW | moon-bridge landing + lower stair run | top, right | left, bottom |
| B | NW | upper stair run + cloud gate | bottom, right | top, left |
| C | NE | book pavilion (the name that fell) | left, bottom | top, right |
| D | SE | before the throne | left, top | right, bottom |

Play order is A -> B -> C -> D (a Z path), so each block has at most two graded
edges, three seams per run instead of six.

## Pipeline

1. `prompts/block<X>-paste-ready-3x2.txt` — the whole prompt, paste as one block.
2. Generate at 3:2, largest size the tool allows. Compose for a 16:9 centre crop
   (the outer 8% top and bottom are sacrificial).
3. Cut into four 1360x768 tiles **after** applying the edge ramps (the ramps are
   deterministic, applied by script, never by the generator).
4. Owner upscales each tile 2x to 2720x1536.
5. Stitch 2x2 -> 5440x3072, lay a frosted-glass band of +/-48 px (Gaussian radius
   16) over the two inner seams, normalise to 5504x3072.

The generator was asked for the ramps directly five times and never produced
them; adding them by script is exact (known hex per edge) and free.

## Edge ramps

Each graded edge ramps over its outer 140 px toward the neighbour's dominant
colour, 65% blend strength — enough for the two panels to meet in one colour
family, light enough that the frosted glass does the rest.

| Block | Edge | Target |
| --- | --- | --- |
| A | top / right | #F6F9FD / #E7F1F9 |
| B | bottom / right | #F4F8FC / #F0F4F0 |
| C | left / bottom | #F0F4F0 / #EAF0F6 |
| D | left / top | #E7F1F9 / #EAF0F6 |

## Measured palette per block (mean RGB / saturation / value)

| Block | RGB | Saturation | Value |
| --- | --- | --- | --- |
| A | 177/189/196 | 15.7% | 187 |
| B | 198/201/196 | 10.9% | 198 |
| C | 151/154/158 | 12.5% | 155 |

C is ~40 points darker than A and B. A single grade pass over all four blocks
(target value 175-195, saturation 12-14%) belongs with the level data step, not
per image — grading tiles separately makes them chase each other.

## Seam steps (0-255, mean across the seam line)

| Block | before frosted glass | after |
| --- | --- | --- |
| A | 3.53 | 0.24 |
| B | 5.28 | 0.24 |
| C | 18.32 | 0.51 |

C's vertical seam crosses the open book, so the glass softens ~48 px of its spine.
Accepted: the book is a collision prop and the band is 0.9% of the panel width.

## Watermarks

Every generated plate carries a `可灵AI` mark in the bottom-right corner. Erasing
it on the first version destroys sharpness, so the mark is left in place and
removed after upscaling — the corner always lands in the `br` tile.

## Known deviations

- **B**: the gate roof came out more saturated gold than the palette asks for, and
  a retaining wall at the lower left contains coloured pebbles. Both are colour
  drift, handled by the grade pass, not a re-roll.
- **C**: no stairs, by decision — the two earlier attempts were cut off by the
  frame edge, and C's bottom edge is the seam with D, where a high-contrast step
  would be wiped by the frosted glass. The stair motif already lives in B.
- **C**: the four round objects came out as taiko drums (burgundy body, gold studs).
  They read fine as drum stools; recolouring them to stone is a later option.
- **D**: not generated yet.

## Files

- `blocks/` — the four finished 5504x3072 panels (this is what the level data will
  point at, once the 4-block background support lands for this level).
- `plates/` — the raw generated image per block plus its ramped version. Kept
  because the generator cannot reproduce an exact plate.
- `manifests/` — per block: source path, ramps applied, tile grid, decisions.
- `tiles/` — the four 1360x768 cut tiles (`png`) and the four upscaled returns
  (`jpg`).
- `prompts/` — one paste-ready prompt per block, plus the four-block spec.
