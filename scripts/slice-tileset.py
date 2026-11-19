"""
scripts/slice-tileset.py
--------------------------------------------------------------------------
Slice a painted scene into uniform tiles and pack them into a single atlas.

Phaser reads a packed atlas as a Tiled single-image tileset: one uniform grid
of frames, no atlas JSON. Frame order therefore has to match the map's
row-major tile order, so source tile (col, row) becomes frame
row * atlasColumns + col. Because the trial map lays the source image back
down unchanged, its tile data is then simply gids 1..N in order.

Usage:
    python scripts/slice-tileset.py <source.png> <tile> <atlasColumns> <out.png>
    python scripts/slice-tileset.py --verify <source.png> <tile> <atlasColumns> <atlas.png>

--verify rebuilds the source image from the atlas alone and demands a
pixel-exact match. It re-derives the layout from the ordering documented
above rather than importing the slicer, so the two have to agree
independently for the check to pass.
"""

import sys

from PIL import Image, ImageChops


def layout(width, height, tile, atlas_columns):
    if width % tile or height % tile:
        sys.exit(f"{width}x{height} is not a whole number of {tile}px tiles")
    cols, rows = width // tile, height // tile
    count = cols * rows
    atlas_cols = min(count, atlas_columns)
    atlas_rows = -(-count // atlas_cols)
    return cols, rows, count, atlas_cols, atlas_rows


def frame_rect(index, atlas_cols, tile):
    """Where frame `index` sits in the atlas — the ordering both modes share."""
    return (
        (index % atlas_cols) * tile,
        (index // atlas_cols) * tile,
        (index % atlas_cols) * tile + tile,
        (index // atlas_cols) * tile + tile,
    )


def main(argv):
    verify = bool(argv) and argv[0] == "--verify"
    args = argv[1:] if verify else argv
    if len(args) != 4:
        sys.exit(__doc__)
    source_path, tile_arg, columns_arg, atlas_path = args
    tile, atlas_columns = int(tile_arg), int(columns_arg)

    source = Image.open(source_path)
    cols, rows, count, atlas_cols, atlas_rows = layout(
        source.width, source.height, tile, atlas_columns
    )

    if verify:
        atlas = Image.open(atlas_path)
        rebuilt = Image.new(source.mode, source.size)
        for row in range(rows):
            for col in range(cols):
                rect = frame_rect(row * cols + col, atlas_cols, tile)
                rebuilt.paste(atlas.crop(rect), (col * tile, row * tile))

        diff = ImageChops.difference(source.convert("RGBA"), rebuilt.convert("RGBA"))
        box = diff.getbbox()
        peak = max(band[1] for band in diff.getextrema())
        print(f"rebuilt {source.width}x{source.height} from a {atlas.width}x{atlas.height} atlas")
        print(f"max channel delta: {peak}")
        if box is not None:
            sys.exit(f"MISMATCH inside {box}")
        print("pixel-exact: the tilemap reproduces the source image")
        return

    atlas = Image.new("RGBA", (atlas_cols * tile, atlas_rows * tile), (0, 0, 0, 0))
    for row in range(rows):
        for col in range(cols):
            index = row * cols + col
            ax = (index % atlas_cols) * tile
            ay = (index // atlas_cols) * tile
            atlas.paste(source.crop((col * tile, row * tile, col * tile + tile, row * tile + tile)), (ax, ay))
    atlas.save(atlas_path)
    print(f"source {source.width}x{source.height} -> {cols}x{rows} = {count} tiles of {tile}px")
    print(f"atlas  {atlas_cols}x{atlas_rows} frames = {atlas.width}x{atlas.height}px -> {atlas_path}")


if __name__ == "__main__":
    main(sys.argv[1:])