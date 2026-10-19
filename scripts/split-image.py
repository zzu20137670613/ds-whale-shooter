"""
scripts/split-image.py
--------------------------------------------------------------------------
Cut one painted scene into an NxN grid of OVERLAPPING tiles, for the
"upscale every tile, then stitch them back" art pipeline.

Why overlap: two tiles upscaled independently do not invent the same edge
detail, and a hard butt-join turns that disagreement into a visible line.
Overlapping them lets the stitch cross-fade the shared band away. 15-25% of
the tile is the working range.

Tile origins are `i * (tile - overlap)`, which is what makes the grid cover
the source exactly:

    grid * tile - (grid - 1) * overlap == source size

Usage:
    python scripts/split-image.py <source.png> <out-dir> [--grid 3]
        [--overlap-x N] [--overlap-y N] [--prefix name]
    python scripts/split-image.py --verify <out-dir>

`--verify` rebuilds the source from the tiles listed in the manifest alone
and demands a pixel-exact match, so a cut can never silently drop or shift
part of the painting.
"""

import json
import os
import sys

from PIL import Image, ImageChops

TARGET_OVERLAP_RATIO = 0.18


def choose_overlap(size, grid):
    """Smallest-overlap-first search for a ratio near the target that divides."""
    best = None
    for overlap in range(0, size // 2 + 1):
        if (size + (grid - 1) * overlap) % grid:
            continue
        tile = (size + (grid - 1) * overlap) // grid
        ratio = overlap / tile
        score = abs(ratio - TARGET_OVERLAP_RATIO)
        if best is None or score < best[0]:
            best = (score, overlap, tile)
    if best is None:
        sys.exit(f"no overlap works for {size}px across {grid} columns")
    _, overlap, tile = best
    return overlap, tile


def build_manifest(source_path, source, grid, overlap_x, overlap_y, prefix):
    if (source.width + (grid - 1) * overlap_x) % grid:
        sys.exit(
            f"{source.width}px with overlap-x {overlap_x} does not divide into "
            f"{grid} columns"
        )
    if (source.height + (grid - 1) * overlap_y) % grid:
        sys.exit(
            f"{source.height}px with overlap-y {overlap_y} does not divide into "
            f"{grid} rows"
        )

    tile_w = (source.width + (grid - 1) * overlap_x) // grid
    tile_h = (source.height + (grid - 1) * overlap_y) // grid
    step_x, step_y = tile_w - overlap_x, tile_h - overlap_y

    tiles = []
    for row in range(grid):
        for col in range(grid):
            tiles.append(
                {
                    "file": f"{prefix}_r{row}c{col}.png",
                    "row": row,
                    "col": col,
                    "x": col * step_x,
                    "y": row * step_y,
                }
            )

    return {
        "source": source_path,
        "sourceWidth": source.width,
        "sourceHeight": source.height,
        "grid": grid,
        "tileWidth": tile_w,
        "tileHeight": tile_h,
        "overlapX": overlap_x,
        "overlapY": overlap_y,
        "stepX": step_x,
        "stepY": step_y,
        "tiles": tiles,
    }


def print_report(manifest):
    grid = manifest["grid"]
    print(
        f"source {manifest['sourceWidth']}x{manifest['sourceHeight']} -> "
        f"{grid}x{grid} = {grid * grid} tiles of "
        f"{manifest['tileWidth']}x{manifest['tileHeight']}px"
    )
    print(
        f"overlap {manifest['overlapX']}px x / {manifest['overlapY']}px y "
        f"= {manifest['overlapX'] / manifest['tileWidth']:.1%} / "
        f"{manifest['overlapY'] / manifest['tileHeight']:.1%} of a tile"
    )
    print("upscaled and stitched back, the scene becomes:")
    for scale in (1, 2, 3, 4):
        w = manifest["sourceWidth"] * scale
        h = manifest["sourceHeight"] * scale
        print(f"  {scale}x -> {w}x{h}px   {w * h * 4 / 1024 / 1024:.1f} MB in VRAM")


def verify(out_dir):
    with open(os.path.join(out_dir, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)

    rebuilt = Image.new(
        "RGBA", (manifest["sourceWidth"], manifest["sourceHeight"]), (0, 0, 0, 0)
    )
    for tile in manifest["tiles"]:
        part = Image.open(os.path.join(out_dir, tile["file"])).convert("RGBA")
        rebuilt.paste(part, (tile["x"], tile["y"]))

    source = Image.open(manifest["source"]).convert("RGBA")
    diff = ImageChops.difference(source, rebuilt)
    box = diff.getbbox()
    peak = max(band[1] for band in diff.getextrema())
    print(f"rebuilt {rebuilt.width}x{rebuilt.height} from {len(manifest['tiles'])} tiles")
    print(f"max channel delta: {peak}")
    if box is not None:
        sys.exit(f"MISMATCH inside {box}")
    print("pixel-exact: the tiles cover the source with nothing lost or shifted")


def main(argv):
    if argv and argv[0] == "--verify":
        if len(argv) != 2:
            sys.exit(__doc__)
        verify(argv[1])
        return

    grid = 3
    prefix = "tile"
    overlap_x = overlap_y = None
    positional = []
    rest = list(argv)
    while rest:
        arg = rest.pop(0)
        if arg == "--grid":
            grid = int(rest.pop(0))
        elif arg == "--prefix":
            prefix = rest.pop(0)
        elif arg == "--overlap-x":
            overlap_x = int(rest.pop(0))
        elif arg == "--overlap-y":
            overlap_y = int(rest.pop(0))
        else:
            positional.append(arg)
    if len(positional) != 2:
        sys.exit(__doc__)
    source_path, out_dir = positional

    source = Image.open(source_path).convert("RGBA")
    if overlap_x is None:
        overlap_x, _ = choose_overlap(source.width, grid)
    if overlap_y is None:
        overlap_y, _ = choose_overlap(source.height, grid)

    manifest = build_manifest(source_path, source, grid, overlap_x, overlap_y, prefix)
    os.makedirs(out_dir, exist_ok=True)

    for tile in manifest["tiles"]:
        part = source.crop(
            (
                tile["x"],
                tile["y"],
                tile["x"] + manifest["tileWidth"],
                tile["y"] + manifest["tileHeight"],
            )
        )
        part.save(os.path.join(out_dir, tile["file"]))

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print_report(manifest)
    print(f"wrote {len(manifest['tiles'])} tiles + manifest.json -> {out_dir}")


if __name__ == "__main__":
    main(sys.argv[1:])