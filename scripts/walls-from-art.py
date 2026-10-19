"""
scripts/walls-from-art.py
--------------------------------------------------------------------------
Draft `airWalls` collision for a level straight from its painted art, so a
new map does not need every wall traced by hand.

The rule is the one the level YAMLs already encode: whatever the player
cannot stand on is walled off. So we classify every pixel as walkable floor
or blocked, drop the walkable cells that the border cannot reach (those are
holes inside furniture, not rooms), and merge the remaining blocked cells
into as few axis-aligned rectangles as the greedy sweep can manage — which
is the shape every hand-authored level already uses.

Output is a DRAFT for review, never a shipped file: painted contact shadows
inflate blobs and a tilted landmark becomes a staircase of rects. Always look
at the preview before pasting the YAML.

Usage:
    python scripts/walls-from-art.py <art.png> [--origin X,Y] [--cell 32]
        [--emit-mask mask.png] [--out-yaml walls.yaml] [--preview preview.png]
        [--bleed 24] [--dark 40] [--cool 10] [--void-lum 90]
        [--detail-thresh 14] [--detail-radius 16] [--min-area 4000]
        [--kind short] [--id-prefix wall]
    python scripts/walls-from-art.py --from-mask mask.png [--out-yaml walls.yaml]
        [--preview preview.png] [--origin X,Y] [--cell 32] [--bleed 24]

Two passes, on purpose. Colour and texture thresholds can find the dark voids
and the busy furniture, but they cannot find a *semantic* wall: on the tavern
painting the sea and the bar counter are not dark at all (mean luminance 142),
and no threshold recovers the six hand-authored walls. So the classifier is a
starting draft only — run it with `--emit-mask`, look at the mask, paint the
corrections onto it in any editor (white = blocked), then run the second pass
with `--from-mask` to turn the corrected mask into exact rectangles. The
numbers this prints (walkable %) are the same ones used to judge art openness.

`--origin` is the world-pixel position of the art's top-left corner, so a
tile of a bigger assembled map can be processed on its own and still emit
world coordinates. `--bleed` pushes border-hugging rects outward by that many
world pixels, matching the hand-authored walls that overhang the painting.
"""

import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DARK = 40
COOL = 10
VOID_LUM = 90
DETAIL_THRESH = 14
DETAIL_RADIUS = 16
CELL = 32
BLEED = 24
MIN_AREA = 4000


def luminance(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def detail_map(lum, radius):
    """Local edge energy. A wide blur is the point: thin floor seams wash out while
    furniture, water and starfields keep sustained detail."""
    gy, gx = np.gradient(lum)
    mag = np.clip(np.hypot(gx, gy), 0, 255).astype(np.uint8)
    blurred = Image.fromarray(mag).filter(ImageFilter.BoxBlur(radius))
    return np.asarray(blurred, dtype=np.float32)


def classify_terms(rgb, dark, cool, void_lum, detail_thresh, detail_radius):
    r, b = rgb[..., 0], rgb[..., 2]
    lum = luminance(rgb)
    dark_hit = lum < dark
    void_hit = (b > r + cool) & (lum < void_lum)
    detail_hit = detail_map(lum, detail_radius) > detail_thresh
    return dark_hit, void_hit, detail_hit


def cell_mask(blocked, cell):
    """One cell is blocked when at least half of its pixels are."""
    rows, cols = blocked.shape[0] // cell, blocked.shape[1] // cell
    trimmed = blocked[: rows * cell, : cols * cell]
    return trimmed.reshape(rows, cell, cols, cell).mean(axis=(1, 3)) >= 0.5


def reachable(free):
    """Flood the free cells inward from the border; whatever stays dry is enclosed."""
    hit = np.zeros_like(free)
    rows, cols = free.shape
    stack = []
    for x in range(cols):
        for y in (0, rows - 1):
            if free[y, x] and not hit[y, x]:
                hit[y, x] = True
                stack.append((y, x))
    for y in range(rows):
        for x in (0, cols - 1):
            if free[y, x] and not hit[y, x]:
                hit[y, x] = True
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < rows and 0 <= nx < cols and free[ny, nx] and not hit[ny, nx]:
                hit[ny, nx] = True
                stack.append((ny, nx))
    return hit


def greedy_rects(solid):
    """Merge solid cells into few axis-aligned rectangles by sweeping rows."""
    rows, cols = solid.shape
    used = np.zeros_like(solid)
    rects = []
    for y in range(rows):
        x = 0
        while x < cols:
            if not solid[y, x] or used[y, x]:
                x += 1
                continue
            width = 1
            while x + width < cols and solid[y, x + width] and not used[y, x + width]:
                width += 1
            height = 1
            while y + height < rows:
                row = solid[y + height, x : x + width]
                if not row.all() or used[y + height, x : x + width].any():
                    break
                height += 1
            used[y : y + height, x : x + width] = True
            rects.append((x, y, width, height))
            x += width
    return rects


def to_world(rects, cell, origin, cols, rows, bleed):
    """Cell rects -> world-pixel corner lists, with border-hugging sides bled out."""
    ox, oy = origin
    out = []
    for x, y, cw, ch in rects:
        x0, y0 = ox + x * cell, oy + y * cell
        x1, y1 = x0 + cw * cell, y0 + ch * cell
        if x == 0:
            x0 -= bleed
        if y == 0:
            y0 -= bleed
        if x + cw == cols:
            x1 += bleed
        if y + ch == rows:
            y1 += bleed
        out.append([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
    return out


def emit_yaml(polys, kind, prefix):
    lines = ["airWalls:"]
    for i, pts in enumerate(polys, start=1):
        lines.append(f"    - id: {prefix}-{i}")
        lines.append(f"      kind: {kind}")
        lines.append("      points:")
        for x, y in pts:
            lines.append(f"          - - {x}")
            lines.append(f"            - {y}")
    return "\n".join(lines) + "\n"


def draw_preview(rgb, solid, polys, cell, origin, path):
    art = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
    mask = solid.repeat(cell, axis=0).repeat(cell, axis=1)
    alpha = Image.new("L", art.size, 0)
    alpha.paste(Image.fromarray((mask * 110).astype(np.uint8)), (0, 0))
    tint = Image.new("RGBA", art.size, (255, 64, 64, 0))
    tint.putalpha(alpha)
    art = Image.alpha_composite(art, tint)
    draw = ImageDraw.Draw(art)
    ox, oy = origin
    for pts in polys:
        draw.line(
            [(x - ox, y - oy) for x, y in pts] + [(pts[0][0] - ox, pts[0][1] - oy)],
            fill=(64, 255, 255, 255),
            width=3,
        )
    art.convert("RGB").save(path)
    return path


def main(argv):
    image_path = None
    origin = (0, 0)
    out_yaml = None
    preview = None
    emit_mask = None
    from_mask = None
    cell, dark, cool, void_lum, bleed, min_area = CELL, DARK, COOL, VOID_LUM, BLEED, MIN_AREA
    detail_thresh, detail_radius = DETAIL_THRESH, DETAIL_RADIUS
    kind, prefix = "short", "wall"

    rest = list(argv)
    while rest:
        arg = rest.pop(0)
        if arg == "--origin":
            origin = tuple(int(v) for v in rest.pop(0).split(","))
        elif arg == "--out-yaml":
            out_yaml = rest.pop(0)
        elif arg == "--preview":
            preview = rest.pop(0)
        elif arg == "--emit-mask":
            emit_mask = rest.pop(0)
        elif arg == "--from-mask":
            from_mask = rest.pop(0)
        elif arg == "--cell":
            cell = int(rest.pop(0))
        elif arg == "--dark":
            dark = int(rest.pop(0))
        elif arg == "--cool":
            cool = int(rest.pop(0))
        elif arg == "--void-lum":
            void_lum = int(rest.pop(0))
        elif arg == "--detail-thresh":
            detail_thresh = int(rest.pop(0))
        elif arg == "--detail-radius":
            detail_radius = int(rest.pop(0))
        elif arg == "--bleed":
            bleed = int(rest.pop(0))
        elif arg == "--min-area":
            min_area = int(rest.pop(0))
        elif arg == "--kind":
            kind = rest.pop(0)
        elif arg == "--id-prefix":
            prefix = rest.pop(0)
        elif arg.startswith("--"):
            sys.exit(f"unknown option {arg}\n\n{__doc__}")
        else:
            image_path = arg

    if from_mask is not None:
        mask_img = Image.open(from_mask).convert("L")
        rgb = np.asarray(mask_img, dtype=np.float32)[..., None].repeat(3, axis=2)
        print(
            "mask %s  %dx%d  painted blocked %.1f%%"
            % (from_mask, mask_img.width, mask_img.height, (rgb[..., 0] > 127).mean() * 100)
        )
        grid = cell_mask(rgb[..., 0] > 127, cell)
    elif image_path is not None:
        rgb = np.asarray(Image.open(image_path).convert("RGB"), dtype=np.float32)
        dark_hit, void_hit, detail_hit = classify_terms(
            rgb, dark, cool, void_lum, detail_thresh, detail_radius
        )
        raw = dark_hit | void_hit | detail_hit
        print(
            "flagged by: dark %.1f%%  void %.1f%%  detail %.1f%%  -> raw %.1f%%"
            % (
                dark_hit.mean() * 100,
                void_hit.mean() * 100,
                detail_hit.mean() * 100,
                raw.mean() * 100,
            )
        )
        grid = cell_mask(raw, cell)
    else:
        sys.exit(__doc__)

    free = ~grid
    walkable = reachable(free)
    solid = ~walkable
    rects = greedy_rects(solid)
    cols, rows = int(grid.shape[1]), int(grid.shape[0])
    polys = []
    for rect, pts in zip(rects, to_world(rects, cell, origin, cols, rows, bleed)):
        x, y, cw, ch = rect
        style = ""
        if x == 0 or y == 0 or x + cw == grid.shape[1] or y + ch == grid.shape[0]:
            style = " (border)"
        if cw * ch * cell * cell >= min_area:
            polys.append(pts)
        print(
            "  rect %4d,%-4d %4dx%-4d cells  %8d px world%s"
            % (x, y, cw, ch, cw * ch * cell * cell, style)
        )

    total = grid.size
    print(
        "\n%s  %dx%d px  cell %d\n"
        "walkable cells %d/%d = %.1f%%   walled %.1f%%\n"
        "kept %d rects (min-area %d px), dropped %d small blobs"
        % (
            from_mask or image_path,
            rgb.shape[1],
            rgb.shape[0],
            cell,
            int(walkable.sum()),
            total,
            walkable.sum() / total * 100,
            solid.sum() / total * 100,
            len(polys),
            min_area,
            len(rects) - len(polys),
        )
    )

    if emit_mask:
        out = Image.fromarray((solid * 255).astype(np.uint8)).resize(
            (cols * cell, rows * cell), Image.NEAREST
        )
        out.save(emit_mask)
        print("wrote " + emit_mask)

    yaml_text = emit_yaml(polys, kind, prefix)
    if out_yaml:
        with open(out_yaml, "w", encoding="utf-8") as fh:
            fh.write(yaml_text)
        print(f"\nwrote {out_yaml}")
    else:
        print("\n" + yaml_text, end="")
    if preview:
        print("wrote " + draw_preview(rgb, solid, polys, cell, origin, preview))


if __name__ == "__main__":
    main(sys.argv[1:])