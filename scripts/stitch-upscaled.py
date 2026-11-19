"""
scripts/stitch-upscaled.py
--------------------------------------------------------------------------
Put a split scene back together after each tile has been upscaled, cross-fading
the overlap bands, and report how much the tiles disagree where they overlap.

Why cross-fade: every tile was upscaled on its own, so neighbouring tiles do
not invent identical edge detail. Butt-joining them turns that disagreement
into a visible line; the overlap exists to be blended away. The disagreement
report is the experiment's real result — a small delta means the upscaler was
faithful and the stitch is safe, a large one means it repainted the tiles and
no amount of feathering will hide it.

Usage:
    python scripts/stitch-upscaled.py <tile-dir> <out.png> [--compare ref.png]

<out.png> is the feathered result. <out-hardcut.png> is the same tiles pasted
edge to edge with no blending — keep it next to the feathered one to see what
feathering actually bought.

The scale is inferred from the tiles, so upscale them to whatever size the tool
produces: 2x, 4x, or a fixed size for every tile. Only one requirement — every
tile must come back at the same scale.
"""

import json
import os
import sys

import numpy as np
from PIL import Image


def load_tiles(manifest, tile_dir):
    tiles = []
    for spec in manifest["tiles"]:
        path = os.path.join(tile_dir, spec["file"])
        tiles.append((spec, Image.open(path).convert("RGBA")))
    return tiles


def infer_scale(manifest, tiles):
    scale_x = tiles[0][1].width / manifest["tileWidth"]
    scale_y = tiles[0][1].height / manifest["tileHeight"]
    for spec, img in tiles:
        if (
            abs(img.width / manifest["tileWidth"] - scale_x) > 1e-3
            or abs(img.height / manifest["tileHeight"] - scale_y) > 1e-3
        ):
            sys.exit(
                f"{spec['file']} is {img.width}x{img.height}, a different scale "
                f"from the other tiles"
            )
    return scale_x, scale_y


def axis_ramp(length, band_start, band_end):
    """1 in the middle, ramping to 0 across each band that has a neighbour."""
    weights = np.ones(length, dtype=np.float32)
    centres = np.arange(length, dtype=np.float32) + 0.5
    if band_start:
        weights = np.minimum(weights, centres / band_start)
    if band_end:
        weights = np.minimum(weights, (length - centres) / band_end)
    return np.clip(weights, 0.0, 1.0)


def tile_weights(manifest, spec, width, height, band_x, band_y):
    grid = manifest["grid"]
    left = band_x if spec["col"] > 0 else 0
    right = band_x if spec["col"] < grid - 1 else 0
    top = band_y if spec["row"] > 0 else 0
    bottom = band_y if spec["row"] < grid - 1 else 0
    wx = axis_ramp(width, left, right)
    wy = axis_ramp(height, top, bottom)
    return (wy[:, None] * wx[None, :])[:, :, None]


def stitch(manifest, tiles, scale_x, scale_y, feather):
    width = round(manifest["sourceWidth"] * scale_x)
    height = round(manifest["sourceHeight"] * scale_y)
    band_x = round(manifest["overlapX"] * scale_x)
    band_y = round(manifest["overlapY"] * scale_y)

    if not feather:
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        for spec, img in tiles:
            canvas.paste(img, (round(spec["x"] * scale_x), round(spec["y"] * scale_y)))
        return np.asarray(canvas, dtype=np.uint8), band_x, band_y

    acc = np.zeros((height, width, 4), dtype=np.float32)
    total = np.zeros((height, width, 1), dtype=np.float32)
    for spec, img in tiles:
        arr = np.asarray(img, dtype=np.float32)
        h, w = arr.shape[:2]
        x, y = round(spec["x"] * scale_x), round(spec["y"] * scale_y)
        weight = tile_weights(manifest, spec, w, h, band_x, band_y)
        acc[y : y + h, x : x + w] += arr * weight
        total[y : y + h, x : x + w] += weight
    blended = np.clip(acc / np.maximum(total, 1e-6), 0, 255).round()
    return blended.astype(np.uint8), band_x, band_y


def disagreement(manifest, tiles, band_x, band_y):
    """Per-pixel difference between neighbours inside the band they share."""
    by_pos = {(spec["row"], spec["col"]): img for spec, img in tiles}
    grid = manifest["grid"]
    rows = []
    for (row, col), img in sorted(by_pos.items()):
        here = np.asarray(img, dtype=np.int16)[:, :, :3]
        if col + 1 < grid:
            there = np.asarray(by_pos[(row, col + 1)], dtype=np.int16)[:, :, :3]
            diff = np.abs(here[:, here.shape[1] - band_x :] - there[:, :band_x])
            rows.append((f"r{row}c{col} | r{row}c{col+1}", diff.mean(), diff.max()))
        if row + 1 < grid:
            there = np.asarray(by_pos[(row + 1, col)], dtype=np.int16)[:, :, :3]
            diff = np.abs(here[here.shape[0] - band_y :, :] - there[:band_y, :])
            rows.append((f"r{row}c{col} / r{row+1}c{col}", diff.mean(), diff.max()))
    return rows


def main(argv):
    args = list(argv)
    compare_path = None
    if "--compare" in args:
        index = args.index("--compare")
        compare_path = args[index + 1]
        del args[index : index + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    tile_dir, out_path = args

    with open(os.path.join(tile_dir, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)

    tiles = load_tiles(manifest, tile_dir)
    scale_x, scale_y = infer_scale(manifest, tiles)
    print(
        f"{len(tiles)} tiles at {tiles[0][1].width}x{tiles[0][1].height} "
        f"= {scale_x:.3f}x / {scale_y:.3f}x the {manifest['tileWidth']}x"
        f"{manifest['tileHeight']} cut"
    )

    band_x = round(manifest["overlapX"] * scale_x)
    band_y = round(manifest["overlapY"] * scale_y)

    rows = disagreement(manifest, tiles, band_x, band_y)
    print("\noverlap disagreement (how much the upscaler repainted):")
    worst = 0.0
    for name, mean, peak in rows:
        print(f"  {name:<22} mean {mean:6.2f}   max {int(peak):3d}")
        worst = max(worst, float(mean))
    print(f"  worst mean: {worst:.2f} of 255")

    blended, _, _ = stitch(manifest, tiles, scale_x, scale_y, feather=True)
    Image.fromarray(blended, "RGBA").save(out_path)
    print(f"\nfeathered -> {out_path}  ({blended.shape[1]}x{blended.shape[0]})")

    hard, _, _ = stitch(manifest, tiles, scale_x, scale_y, feather=False)
    hard_path = os.path.splitext(out_path)[0] + "-hardcut.png"
    Image.fromarray(hard, "RGBA").save(hard_path)
    print(f"hard-cut  -> {hard_path}  (no blending, for comparison)")

    if compare_path:
        reference = Image.open(compare_path).convert("RGB")
        result = Image.fromarray(blended, "RGBA").convert("RGB")
        if result.size != reference.size:
            result = result.resize(reference.size, Image.LANCZOS)
        diff = np.abs(
            np.asarray(result, dtype=np.int16) - np.asarray(reference, dtype=np.int16)
        )
        print(
            f"\nvs {os.path.basename(compare_path)} (resized to match): "
            f"mean {diff.mean():.2f}, max {diff.max()}"
        )


if __name__ == "__main__":
    main(sys.argv[1:])