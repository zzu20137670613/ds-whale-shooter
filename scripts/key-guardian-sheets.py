"""Turn the three 11th-Forest 2048x2048 AI sheets into transparent monster sheets.

The raws from `backup-characters-before-whalegirl/raws/` are flat-magenta AI
outputs. This keys the background to alpha 0 and writes the result where the
game loads monster art from. Nothing is resampled: cell size stays 512px so the
guardians match every other monster sheet.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(
    r"C:\Users\15639732925\Documents\deepseek-harness\default-workspace\whale-shooter"
)
RAW = ROOT / "backup-characters-before-whalegirl" / "raws"
OUT = ROOT / "ds-whale-shooter-PC" / "public" / "assets" / "image" / "monsters"

JOBS = {
    "bunny-girl": "bunny",
    "kitty": "kitty",
    "wanderer": "wanderer",
}


def key_magenta(src: Path, dst: Path) -> tuple[str, int]:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    # The AI sheets have one flat background colour. Sample the four corners and
    # take the most common one: a stray magenta pixel in a corner would other-
    # wise key the wrong colour for the whole sheet.
    corners = [
        pixels[1, 1],
        pixels[width - 2, 1],
        pixels[1, height - 2],
        pixels[width - 2, height - 2],
    ]
    marker = max(set(corners), key=corners.count)
    keyed = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            # Magenta family: strong red + strong blue, weak green. The chibi
            # art keeps green out of the background, so this is safe.
            if r > 150 and b > 150 and g < 120 and abs(r - b) < 90:
                pixels[x, y] = (r, g, b, 0)
                keyed += 1
    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst)
    return f"#{marker[0]:02x}{marker[1]:02x}{marker[2]:02x}", keyed


def main() -> int:
    for raw_name, out_name in JOBS.items():
        src = RAW / f"{raw_name}.png"
        if not src.exists():
            print(f"MISSING {src}")
            return 1
        colour, keyed = key_magenta(src, OUT / f"{out_name}.png")
        total = 2048 * 2048
        print(
            f"{raw_name:12s} -> monsters/{out_name}.png  bg={colour}  "
            f"keyed={keyed} ({keyed / total * 100:.1f}%)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())