# Starry Library — map source of truth

The 4-screen-wide (4×4 screens = 2×2 blocks = 4 rooms) world behind the level
【Claude的星空图书馆】. Everything here is committed because it is the only
surviving copy of something upstream in the art chain.

The assembled world image is **not** here — it is a local convenience under
`whale-shooter/art-maps/starry-library/`, and it is byte-for-byte the four
`blocks/` pasted 2×2, so it can always be rebuilt from this folder.

## Layout

| Folder        | What it holds                                                        | Count |
| ------------- | -------------------------------------------------------------------- | ----- |
| `plates/`     | The generated base plates (as delivered, untouched)                  | 7     |
| `tiles/`      | The 1× cut tiles of the four shipped blocks (my `split-image.py` cut) | 16    |
| `manifests/`  | Per-block cut parameters (the recipe that produced `tiles/`)         | 9     |
| `blocks/`     | The four finished rooms, 5504×3072 each                              | 4     |
| `strips/`     | The four 40-px seam strips lifted from the block interiors           | 4     |
| `collision/`  | The two collision masks (1-bit, full world size) + the interpretation | 3     |

`CHECKSUMS.sha256` covers every file below `plates/`, `tiles/` and `blocks/`.

## Blocks are named by position, plates by number

| Block id | Room            | Shipped | Plate in `plates/`                 | Plate dims | Status    |
| -------- | --------------- | ------- | ---------------------------------- | ---------- | --------- |
| `lib00`  | top-left        | yes     | *(lost — see below)*               | 2720×1520  | **lost**  |
| `lib20`  | top-right       | yes     | `lib20-wechat-20261020-091528.png` | 2848×1600  | present   |
| `lib02`  | bottom-left     | yes     | *(lost — see below)*               | 2048×1152  | **lost**  |
| `lib22`  | bottom-right    | yes     | `lib22-open-marble-terrace.png`    | 2720×1520  | present   |
| `lib01`  | 6×6 middle edge | no      | `lib01-game-level-background-1.png`| 2048×1152  | present   |
| `lib10`  | 6×6 middle edge | no      | `lib10-game-level-background.png`  | 2048×1152  | present   |
| `lib11`  | 6×6 centre      | no      | `lib11-game-level-background-4.png`| 2048×1152  | present   |
| `lib12`  | 6×6 middle edge | no      | `lib12-game-level-background-3.png`| 2048×1152  | present   |
| `lib21`  | 6×6 middle edge | no      | `lib21-game-level-background-2.png`| 2048×1152  | present   |

The five `lib01/lib10/lib11/lib12/lib21` plates belong to the abandoned nine-block
(6×6 screens) direction. They are kept because a plate is an original and these
five cost ~16 MB together — delete them if the direction is ever formally dropped.

### The two lost plates

`lib00` and `lib02` are both in the shipped world, and their base plates are gone
from this machine. Original filenames and last known path:

- `lib00` — `D:\网页下载\Top-Down Magical Library Background.png` (2720×1520)
- `lib02` — `D:\网页下载\Top-Down Flooded Library Vault (1).png` (2048×1152)

Searched 2026-10-21: every image modified between 2026-09-01 and 2026-10-23 under
`D:\` (网页下载, Quark, QQdownload, Temp, 照片, Huawei Share, art-scrap, WUDownloadCache,
Tencent, WeChat), `C:\Users\15639732925\` (Downloads, Desktop, Documents, Pictures,
xwechat_files, WeChat Files) — 2012 + 415 files with their dimensions read. Exactly
eight files match either dimension and none of them is these two images. They are
not renamed escapes; the files are really gone.

The consequence is bounded: `tiles/` plus the owner's 2× returns reconstruct both
blocks exactly, and `blocks/room-tl-lib00.png` / `room-bl-lib02.png` are already
finished. What is lost is only the ability to re-cut those two with a different
overlap — hence `tiles/` earns its place in git.

## Verification that a plate belongs to a block

A filename in a manifest is a claim, not evidence. `whale-shooter/tools/verify-plate-mapping.py`
re-cuts the four tiles from a candidate plate using that block's own manifest
parameters and compares them byte-for-byte with the stored 1× tiles.

Result 2026-10-21 — **7 of 7 located plates reproduce their stored tiles exactly**:
`lib01`, `lib10`, `lib11`, `lib12`, `lib20`, `lib21`, `lib22`. The mapping above is
measured, not inferred.

## Re-cutting a block from its plate

Each `manifests/libXX.json` records the source dimensions, the grid, the tile size,
the overlap and every tile's origin, in source pixels:

```
{ "grid": 2, "tileWidth": 1495, "tileHeight": 835,
  "overlapX": 270, "overlapY": 150, "stepX": 1225, "stepY": 685,
  "tiles": [ { "file": "lib00_r0c0.png", "row": 0, "col": 0, "x": 0, "y": 0 }, … ] }
```

```
python the-11th-forest/scripts/split-image.py <plate.png> <out-dir> --grid 2 \
    --overlap-x <overlapX> --overlap-y <overlapY> --prefix <libXX>
python the-11th-forest/scripts/split-image.py --verify <out-dir>
```

Omitting the overlap flags makes the script search for a ratio near its own 18%
target; passing the manifest's values reproduces that block's cut exactly. `--verify`
rebuilds the plate from the tiles and demands a pixel-exact match, so a cut can never
silently drop or shift part of the painting.

`tiles/` here is those same per-block files (`libXX_rXcY.png`) renamed flat to
`libXX-rXcY.png`; the per-block originals stay in `manifests/` coordinates.

Splitting is lossless cropping, so a re-cut is only needed when the overlap
changes. The 18% overlap exists so the upscaler has context at the seams; the
stitcher trims it back off (`scripts/stitch-upscaled.py`).

## Pipeline position of each folder

```
prompt → plates/ → (cut 2×2, 18% overlap) → tiles/ → owner 2× upscale + watermark erase
       → stitch + normalise 5504×3072 → blocks/ → place 2×2 → frosted glass over the seams
       → the level's background, one block = one room = one screen
```

`strips/` are the 40-px-wide strips the frosted-glass pass lifted out of each
block's interior to lay over the hard seam; `collision/` is the owner's hand
marking converted to masks (red = unreachable, blue = teleport pad).

See `whale-shooter/art-experiment/MULTIBLOCK-MAP-PIPELINE.md` for the full
pipeline, the gradient-at-prompt rules and the paid-for lessons.