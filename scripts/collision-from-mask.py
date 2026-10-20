"""
scripts/collision-from-mask.py
-----------------------------------------------------------------
Turn a hand-painted collision mask into the collision data a level needs:
axis-aligned `airWalls` rectangles, split per room, plus the teleporter
entries, plus a reachability verdict for every teleporter.

Relationship to `walls-from-art.py`: that script is the *classifier* — it
guesses a mask from the painted art and merges it with a row sweep, which
turns a freehand scribble into a staircase of thin rectangles (133 of them
on this map). This script starts from the mask the owner already corrected
and covers it with **largest inscribed rectangles** instead: take the biggest
all-paint rectangle in a blob, subtract it, take the next one, stop when only
crumbs are left. Same input, whole-block output, and — because every
rectangle lies entirely inside the paint — it never blocks a floor cell the
paint left free. (The tempting shortcut, one bounding box per blob, fails
loudly: the owner's top-left marking is a closed loop whose box swallowed a
whole room.)

Mask convention matches the owner's marking: **white = blocked**.
Teleport pads come from a second mask (white = pad).

Usage:
    python scripts/collision-from-mask.py --unreachable mask.png --teleport tp.png
        --room 5504x3072 [--cell 32] [--min-gain 6] [--max-rects 400]
        [--min-area 4000] [--bleed 24] [--min-pad-radius 100] [--kind short]
        [--out-dir DIR] [--art world.png] [--preview png] [--id-prefix wall]

Per room it writes `<out-dir>/<room>-airWalls.yaml` and
`<out-dir>/<room>-teleporters.yaml`; `<out-dir>/world-airWalls.yaml` holds the
unclipped rectangles. The report ends with the reachability verdict — a
teleporter the player cannot actually walk to is a bug, not a detail.
"""

import os
import sys

import numpy as np
from PIL import Image, ImageDraw

CELL = 32
MIN_GAIN = 6
MAX_RECTS = 400
MIN_AREA = 4000
BLEED = 24
MIN_PAD_RADIUS = 100
ROOMS = (("tl", 0, 0), ("tr", 1, 0), ("bl", 0, 1), ("br", 1, 1))


def cell_grid(blocked, cell):
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


def components(solid):
    """Label 8-connected blobs with an explicit stack (no scipy here)."""
    labels = np.zeros(solid.shape, dtype=np.int32)
    rows, cols = solid.shape
    n = 0
    boxes = []
    for y in range(rows):
        for x in range(cols):
            if not solid[y, x] or labels[y, x]:
                continue
            n += 1
            labels[y, x] = n
            stack = [(y, x)]
            y0 = y1 = y
            x0 = x1 = x
            size = 0
            while stack:
                cy, cx = stack.pop()
                size += 1
                if cy < y0:
                    y0 = cy
                if cy > y1:
                    y1 = cy
                if cx < x0:
                    x0 = cx
                if cx > x1:
                    x1 = cx
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < rows and 0 <= nx < cols and solid[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = n
                            stack.append((ny, nx))
            boxes.append((y0, y1, x0, x1, size))
    return labels, boxes


def largest_rect(m):
    """Largest all-true axis-aligned rectangle in a boolean grid.

    Histogram sweep: `heights[x]` is how many consecutive true cells stand above
    the current row at column x, and the classic stack pass turns that into the
    biggest rectangle that *ends* on this row. Returns (x, y, w, h) and its area.
    """
    rows, cols = m.shape
    heights = np.zeros(cols, dtype=np.int32)
    best_area = 0
    best = None
    for y in range(rows):
        heights = np.where(m[y], heights + 1, 0)
        stack = []
        for x in range(cols + 1):
            h = int(heights[x]) if x < cols else 0
            start = x
            while stack and stack[-1][1] > h:
                sx, sh = stack.pop()
                area = sh * (x - sx)
                if area > best_area:
                    best_area = area
                    best = (sx, y - sh + 1, x - sx, sh)
                start = sx
            stack.append((start, h))
    return best, best_area


def blob_rects(solid, min_gain, max_rects):
    """Greedy maximal-rectangle cover — whole blocks, and not one free cell more.

    The obvious "one bounding box per blob" is a trap worth recording: the owner's
    top-left marking is a *closed loop* around the room, its blob fills only 20% of
    its own box, and the box therefore swallowed the whole room (TL came out 0%
    walkable). Taking the largest inscribed rectangle, subtracting it, and taking
    the next one instead turns that loop into its four arms — and because every
    rectangle is entirely inside the paint, no floor the paint left free is ever
    blocked. A tilted landmark still costs a few rectangles, never a staircase.
    """
    labels, boxes = components(solid)
    rects = []
    for y0, y1, x0, x1, size in boxes:
        sub = (labels[y0 : y1 + 1, x0 : x1 + 1] > 0).copy()
        remaining = int(sub.sum())
        # 2% of a blob may stay uncovered: thinning a blob to its specks is not
        # worth another rectangle, and `min_gain` catches the single-cell leftovers.
        budget = max(1, int(remaining * 0.02))
        while remaining > budget and len(rects) < max_rects:
            (rx, ry, rw, rh), area = largest_rect(sub)
            if not area or area < min_gain:
                break
            sub[ry : ry + rh, rx : rx + rw] = False
            remaining -= area
            rects.append((x0 + rx, y0 + ry, rw, rh))
    return rects, len(boxes)


def rect_world(rect, cell, cols, rows, bleed):
    x, y, cw, ch = rect
    x0, y0 = x * cell, y * cell
    x1, y1 = x0 + cw * cell, y0 + ch * cell
    if x == 0:
        x0 -= bleed
    if y == 0:
        y0 -= bleed
    if x + cw == cols:
        x1 += bleed
    if y + ch == rows:
        y1 += bleed
    return x0, y0, x1, y1


def emit_airwalls(rects, prefix, kind):
    lines = ["airWalls:"]
    for i, (x0, y0, x1, y1) in enumerate(rects, start=1):
        lines.append(f"    - id: {prefix}-{i}")
        lines.append(f"      kind: {kind}")
        lines.append("      points:")
        for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
            lines.append(f"          - - {x}")
            lines.append(f"            - {y}")
    return "\n".join(lines) + "\n"


def emit_teleporters(entries):
    lines = []
    if not entries:
        return ""
    lines.append("teleporters:")
    for e in entries:
        lines.append(f"    - id: {e['id']}")
        lines.append(f"      x: {e['x']}")
        lines.append(f"      y: {e['y']}")
        lines.append(f"      radius: {e['radius']}")
    return "\n".join(lines) + "\n"


def erode(free):
    e = free.copy()
    e[1:, :] &= free[:-1, :]
    e[:-1, :] &= free[1:, :]
    e[:, 1:] &= free[:, :-1]
    e[:, :-1] &= free[:, 1:]
    return e


def clearance(free, y, x, limit=8):
    """Cells of margin around (y, x): how many erosions it survives."""
    k = 0
    cur = free
    while k < limit:
        cur = erode(cur)
        if not cur[y, x]:
            break
        k += 1
    return k


def label_components(free):
    labels = np.zeros(free.shape, dtype=np.int32)
    rows, cols = free.shape
    n = 0
    for y in range(rows):
        for x in range(cols):
            if not free[y, x] or labels[y, x]:
                continue
            n += 1
            labels[y, x] = n
            stack = [(y, x)]
            while stack:
                cy, cx = stack.pop()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < rows and 0 <= nx < cols and free[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = n
                        stack.append((ny, nx))
    return labels, n


def main(argv):
    unreachable = teleport = out_dir = art = preview = None
    cell, min_gain, max_rects, min_area, bleed = CELL, MIN_GAIN, MAX_RECTS, MIN_AREA, BLEED
    min_pad_radius = MIN_PAD_RADIUS
    small = []
    kind, prefix = "short", "wall"
    room_w = room_h = None

    rest = list(argv)
    while rest:
        arg = rest.pop(0)
        if arg == "--unreachable":
            unreachable = rest.pop(0)
        elif arg == "--teleport":
            teleport = rest.pop(0)
        elif arg == "--room":
            room_w, room_h = (int(v) for v in rest.pop(0).split("x"))
        elif arg == "--cell":
            cell = int(rest.pop(0))
        elif arg == "--min-gain":
            min_gain = int(rest.pop(0))
        elif arg == "--max-rects":
            max_rects = int(rest.pop(0))
        elif arg == "--min-area":
            min_area = int(rest.pop(0))
        elif arg == "--min-pad-radius":
            min_pad_radius = int(rest.pop(0))
        elif arg == "--bleed":
            bleed = int(rest.pop(0))
        elif arg == "--kind":
            kind = rest.pop(0)
        elif arg == "--id-prefix":
            prefix = rest.pop(0)
        elif arg == "--out-dir":
            out_dir = rest.pop(0)
        elif arg == "--art":
            art = rest.pop(0)
        elif arg == "--preview":
            preview = rest.pop(0)
        else:
            sys.exit(f"unknown option {arg}\n\n{__doc__}")

    if not unreachable or not room_w or not room_h:
        sys.exit(__doc__)

    blocked = np.asarray(Image.open(unreachable).convert("L")) > 127
    grid = cell_grid(blocked, cell)
    rows, cols = grid.shape
    walkable = reachable(~grid)
    solid = ~walkable
    print(
        "mask %dx%d px  cell %d  grid %dx%d\n"
        "painted blocked %.1f%%  after closing holes solid %.1f%%  walkable %.1f%%"
        % (
            blocked.shape[1],
            blocked.shape[0],
            cell,
            cols,
            rows,
            blocked.mean() * 100,
            solid.mean() * 100,
            walkable.mean() * 100,
        )
    )

    rects, blobs = blob_rects(solid, min_gain, max_rects)
    kept = [r for r in rects if r[2] * r[3] * cell * cell >= min_area]
    dropped = sum(r[2] * r[3] for r in rects) - sum(r[2] * r[3] for r in kept)
    print(
        "blobs %d -> %d rectangles, %d kept, %d specks dropped below min-area %d px (%.2f%% of the paint)"
        % (
            blobs,
            len(rects),
            len(kept),
            len(rects) - len(kept),
            min_area,
            dropped / max(solid.sum(), 1) * 100,
        )
    )
    world = [rect_world(r, cell, cols, rows, bleed) for r in kept]
    print("rect count vs the row-sweep draft: %d (draft was 133)" % len(world))

    # The numbers that matter are the rectangles' own, not the mask's: a bounding
    # box necessarily swallows some floor the paint left free. Report the cost.
    rect_solid = np.zeros_like(solid)
    for x, y, cw, ch in kept:
        rect_solid[y : y + ch, x : x + cw] = True
    print(
        "\nrects cover %.1f%% of the world (mask painted %.1f%%) -> "
        "rect walkable %.1f%%  vs  mask walkable %.1f%%  (bbox costs %+.1f points)"
        % (
            rect_solid.mean() * 100,
            solid.mean() * 100,
            (~rect_solid).mean() * 100,
            (~solid).mean() * 100,
            (~rect_solid).mean() * 100 - (~solid).mean() * 100,
        )
    )
    covered = int((rect_solid & solid).sum())
    print(
        "paint covered by the rectangles: %.1f%% (%.1f%% of the paint is left "
        "walkable — specks and the 2%% crumb budget per blob)"
        % (covered / max(int(solid.sum()), 1) * 100, 100 - covered / max(int(solid.sum()), 1) * 100)
    )
    biggest = sorted(kept, key=lambda r: -(r[2] * r[3]))[:6]
    print("largest rectangles (world px):")
    for x, y, cw, ch in biggest:
        print(
            "    %5d,%-5d  %5dx%-5d  %8d px  %4.1f%% of a room"
            % (
                x * cell,
                y * cell,
                cw * cell,
                ch * cell,
                cw * ch * cell * cell,
                cw * ch * cell * cell / (room_w * room_h) * 100,
            )
        )

    # ── teleport pads: one blob each, centre + fitted radius ──
    pads = []
    if teleport:
        tmask = np.asarray(Image.open(teleport).convert("L")) > 127
        tgrid = cell_grid(tmask, cell)
        labels, n = label_components(tgrid)
        for i in range(1, n + 1):
            ys, xs = np.nonzero(labels == i)
            if ys.size * cell * cell < min_area:
                continue
            cx = int(xs.mean() * cell + cell / 2)
            cy = int(ys.mean() * cell + cell / 2)
            radius = int(np.sqrt(ys.size * cell * cell / np.pi))
            # The owner's blue pen also left a dashed trail of specks (8 blobs of
            # radius 36-57 px against the two real pads' 361-374 px). A pad smaller
            # than the player (60 px wide) is not a pad, so the small ones are
            # reported and dropped rather than shipped.
            if radius < min_pad_radius:
                small.append((cx, cy, radius))
                continue
            pads.append({"x": cx, "y": cy, "radius": radius, "cells": ys.size})
        print(
            "\nteleport pads: %d kept (min radius %d px); %d specks dropped"
            % (len(pads), min_pad_radius, len(small))
        )
        for cx, cy, radius in small:
            print("      dropped (%d,%d) r=%d" % (cx, cy, radius))

    # ── per room: clip, verify ──
    world_w, world_h = cols * cell, rows * cell
    pad_room = {}
    for p in pads:
        ai = min(p["x"] // room_w, world_w // room_w - 1)
        aj = min(p["y"] // room_h, world_h // room_h - 1)
        pad_room.setdefault((ai, aj), []).append(p)

    report = []
    per_room = {}
    for name, ai, aj in ROOMS:
        ox, oy = ai * room_w, aj * room_h
        clipped = []
        for x0, y0, x1, y1 in world:
            cx0, cy0 = max(x0, ox), max(y0, oy)
            cx1, cy1 = min(x1, ox + room_w), min(y1, oy + room_h)
            if cx1 - cx0 >= cell and cy1 - cy0 >= cell:
                clipped.append(
                    (cx0 - ox, cy0 - oy, min(cx1 - ox, room_w), min(cy1 - oy, room_h))
                )
        per_room[name] = clipped

        # free space as the level will actually build it — from the rectangles,
        # not from the paint, so the verdict reflects what ships.
        r0, r1 = aj * (room_h // cell), (aj + 1) * (room_h // cell)
        c0, c1 = ai * (room_w // cell), (ai + 1) * (room_w // cell)
        room_solid = rect_solid[r0:r1, c0:c1]
        free = ~room_solid
        labels, n = label_components(free)
        sizes = [int((labels == i).sum()) for i in range(1, n + 1)]
        biggest = int(np.argmax(sizes)) + 1 if sizes else 0
        line = "%-3s %4d rects  walkable %5.1f%%  open regions %d" % (
            name,
            len(clipped),
            free.mean() * 100,
            n,
        )
        for p in pad_room.get((ai, aj), []):
            py = p["y"] // cell - r0
            px = p["x"] // cell - c0
            lab = labels[py, px] if 0 <= py < labels.shape[0] and 0 <= px < labels.shape[1] else 0
            clear = clearance(free, py, px) * cell
            ok = lab == biggest and lab != 0
            line += "\n      pad (%d,%d) r=%d  region %d/%d %s  clearance %d px %s" % (
                p["x"],
                p["y"],
                p["radius"],
                lab,
                biggest,
                "connected" if ok else "ISOLATED",
                clear,
                "ok" if clear >= 64 else "TOO NARROW (<64)",
            )
        report.append(line)

    print("\n" + "\n".join(report))

    if not out_dir:
        return
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "world-airWalls.yaml"), "w", encoding="utf-8") as fh:
        fh.write(emit_airwalls(world, prefix, kind))
    for name, _ai, _aj in ROOMS:
        with open(os.path.join(out_dir, f"{name}-airWalls.yaml"), "w", encoding="utf-8") as fh:
            fh.write(emit_airwalls(per_room[name], f"{prefix}-{name}", kind))
        entries = []
        for i, p in enumerate(pad_room.get((_ai, _aj), []), start=1):
            entries.append(
                {
                    "id": f"{name}-pad-{i}",
                    "x": p["x"] - _ai * room_w,
                    "y": p["y"] - _aj * room_h,
                    "radius": p["radius"],
                }
            )
        text = emit_teleporters(entries)
        if text:
            with open(os.path.join(out_dir, f"{name}-teleporters.yaml"), "w", encoding="utf-8") as fh:
                fh.write(text)
    print("wrote per-room airWalls + teleporters -> " + out_dir)

    if preview:
        if art and os.path.exists(art):
            base = Image.open(art).convert("RGB")
        else:
            base = Image.fromarray(
                np.where(solid[..., None], 255, 0).astype(np.uint8).repeat(3, axis=2)
            )
        # tint exactly what the rectangles block, so the cost of whole-blob
        # merging is visible at a glance instead of only in the printed number
        block_full = np.kron(rect_solid, np.ones((cell, cell), dtype=bool))
        h = min(block_full.shape[0], base.height)
        w = min(block_full.shape[1], base.width)
        tint = Image.new("RGBA", base.size, (255, 48, 48, 0))
        alpha = Image.new("L", base.size, 0)
        alpha.paste(Image.fromarray((block_full[:h, :w] * 96).astype(np.uint8)), (0, 0))
        tint.putalpha(alpha)
        base = Image.alpha_composite(base.convert("RGBA"), tint).convert("RGB")
        draw = ImageDraw.Draw(base)
        for x0, y0, x1, y1 in world:
            draw.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(64, 255, 255), width=4)
        for p in pads:
            draw.ellipse(
                (p["x"] - p["radius"], p["y"] - p["radius"], p["x"] + p["radius"], p["y"] + p["radius"]),
                outline=(64, 128, 255),
                width=6,
            )
        for ai, aj in ((1, 0), (0, 1), (1, 1)):
            draw.line((ai * room_w, 0, ai * room_w, world_h), fill=(255, 210, 64), width=4)
            draw.line((0, aj * room_h, world_w, aj * room_h), fill=(255, 210, 64), width=4)
        base.save(preview)
        print("wrote " + preview)


if __name__ == "__main__":
    main(sys.argv[1:])