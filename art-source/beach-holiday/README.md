# Beach Holiday — art source

The beach level (`public/data/levels/beach-holiday.yaml`) is being rebuilt from **1 screen
(2752×1536)** into **2×2 screens (5504×3072)** — exactly one block, so the level still uses a
single `background` image and needs no `backgroundBlocks`.

## Geometry

```
now     2752 × 1536   = 1 screen
target  5504 × 3072   = 2 × 2 screens = 1 block
```

The pipeline is the one already proven on the starry library: cut into 1× tiles, upscale each
2×, stitch back. Tiles are 1376×768; each one upscaled becomes 2752×1536.

## Route A — upscale the existing painting (no repaint)

1. `tiles/beach-tl.png`, `beach-tr.png`, `beach-bl.png`, `beach-br.png` — 1376×768 each, already
   cut from the shipped `beach-holiday.png` (exact halves, no overlap, no feathering).
2. Upscale each tile 2× (owner) → 2752×1536 each.
3. Stitch the four into `blocks/beach.png` at 5504×3072 (agent), then install it as the level's
   `background`.

Consequence to keep in mind: this magnifies the whole painting, so every painted feature (palm,
rock, flower) ends up **twice as large relative to the 60 px player**, while the walkable area
becomes 4×. Per screen you see half as many, twice as large objects. A palm measured ~180 px in
the current art (3 player widths) becomes ~360 px (6 player widths) — which is closer to real
proportions, so the look is acceptable, but the level reads as emptier per screen. Extra
furniture and scattered detail are the fix, not a repaint.

## Route B — repaint the beach as one image

Cheaper than it sounds: one generated image covers the whole world. See
`prompts/img-beach-full-2x2.txt`; then cut it into four tiles and follow Route A from step 2.

Route B is the only route that gets the small table back (Route A depends on finding prop art,
and the owner has accepted dropping the table there).

## Props (lounger / parasol / table)

Furniture is added **after** the upscale, never before it: an AI upscaler repaints whatever it is
given, and it smears small objects. The props themselves should be upscaled 2× separately so
they match the magnified scenery — otherwise a prop pasted at its native size looks half scale.

- `prompts/img-prop-lounger.txt`, `prompts/img-prop-parasol.txt` — single objects, top-down,
  isolated on flat `#808080` so they key out cleanly. Request 1024×1024, plenty for a prop that
  ends up ~200–250 px in the world.
- If prop art is found instead of generated: it must be **top-down** (a 3/4 or front view reads
  as a sticker on a painting), **muted** (the measured palette is sun-bleached, mean saturation
  72/255), **free of watermarks**, and licensed for the repository — the repo is a git repo, so
  unlicensed stock art belongs in local `art-maps/`, not in `art-source/`.

## Marking (one mask, three colours)

The owner marks the final image once; `scripts/collision-from-mask.py` is extended to read all
three colours in one pass:

| colour | meaning |
| --- | --- |
| scribble (any wall colour already used, e.g. red) | air wall — becomes collision rectangles |
| **green** | the lounger's trigger zone — **must be walkable**, never a wall, or the player cannot step on it |
| blue | reserved for teleporters, same as the library masks |

The table does not need marking any more: the juice lands beside the lounger, at a point computed
from the lounger's bounding box and checked for walkability.

## Juice easter egg

Step on the lounger → a glass of iced juice pops out, arcs to the landing point, and is picked up
by walking into it → HP and SP refill to full. **Once per run** (not once per level entry, so it
cannot be farmed by leaving and returning); recorded in the store like `brokenProps`, cleared
only when the save is wiped.

## Palette (measured from the current beach art)

```
sand   highlight #f4ddb8   mid #eed3ab / #d0b288   shadow #9d815f
sea    deep #47b0a8        shallow #7ccbba         surf #ede5d4
plants olive #7b7f66       dark green #514d31      rock #9c9585
```

Whole image: mean brightness 175/255, mean saturation 72/255.