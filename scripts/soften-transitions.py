"""Soften hard internal material seams in a starry-library block into gradients.

The nine blocks of the 6x6 world each contain two (or four) style regions. Eight of
them were painted with a soft, gradient transition between the regions; when one
block comes back with a hard cut instead, its boundary reads as a sudden straight
line once the blocks are stitched together. This script turns such a hard cut into
the same kind of gradient the other blocks have.

How it works: across a band centred on the seam, the two sides are cross-faded by
sampling the image just OUTSIDE the band on each side:

    out(x) = (1 - t(x)) * image(x - b) + t(x) * image(x + b)

At the band edges t is 0 and 1, so the result rejoins the untouched image exactly;
inside the band the two materials blend smoothly. Nothing is invented and no
texture is copied from elsewhere, so there is no risk of the "second floor" artefact
that copy-paste inpainting produces.

Usage:
    python scripts/soften-transitions.py <in.png> <out.png>
        [--xw 0.05] [--yw 0.05] [--search 0.40 0.60] [--dry-run]

    --xw / --yw   half-width of the blend band, as a fraction of width / height
    --search      window (fractions) in which the two seams are expected to lie
    --dry-run     only report the detected seam positions, write nothing
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
from PIL import Image


def _box_mean(x: np.ndarray, r: int) -> np.ndarray:
    """Local mean over a (2r+1) square window, computed from an integral image."""
    h, w = x.shape
    c = np.pad(np.cumsum(np.cumsum(x, axis=0), axis=1), ((1, 0), (1, 0)))
    ys = np.clip(np.arange(h) - r, 0, h)
    ye = np.clip(np.arange(h) + r + 1, 0, h)
    xs = np.clip(np.arange(w) - r, 0, w)
    xe = np.clip(np.arange(w) + r + 1, 0, w)
    total = c[np.ix_(ye, xe)] - c[np.ix_(ys, xe)] - c[np.ix_(ye, xs)] + c[np.ix_(ys, xs)]
    return total / ((ye - ys)[:, None] * (xe - xs)[None, :])


def _blend_axis(a: np.ndarray, pos: float, half: float, axis: int) -> np.ndarray:
    """Cross-fade a band of half-width `half` centred on `pos` along `axis`."""
    lo, hi = int(pos - half), int(pos + half)
    if axis == 0:  # vertical seam: blend columns, sample columns half to each side
        left = a[:, lo - int(half):hi - int(half), :]
        right = a[:, lo + int(half):hi + int(half), :]
        t = np.linspace(0.0, 1.0, hi - lo)[None, :, None]
    else:  # horizontal seam: blend rows
        left = a[lo - int(half):hi - int(half), :, :]
        right = a[lo + int(half):hi + int(half), :, :]
        t = np.linspace(0.0, 1.0, hi - lo)[:, None, None]
    out = a.copy()
    if axis == 0:
        out[:, lo:hi, :] = (1.0 - t) * left + t * right
    else:
        out[lo:hi, :, :] = (1.0 - t) * left + t * right
    return out


def _find_seam(rb: np.ndarray, axis: int, lo: int, hi: int) -> int:
    """Locate the strongest colour change (red-minus-blue) inside [lo, hi)."""
    # a vertical seam is measured on the rows that hold the warm/cool floor change;
    # a horizontal seam on the columns that hold it. Using R-B rather than luminance
    # keeps the detector off pale borders and pool rims.
    if axis == 0:
        prof = rb[: rb.shape[0] // 2, :].mean(axis=0)
    else:
        prof = rb[:, : rb.shape[1] // 2].mean(axis=1)
    k = 8
    grad = np.array([abs(prof[i + 3:i + 3 + k].mean() - prof[i - k:i - 3].mean())
                     for i in range(max(k, lo), min(hi, len(prof) - k))])
    return max(k, lo) + int(np.argmax(grad))


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--xw", type=float, default=0.05, help="half-width of the vertical blend band")
    ap.add_argument("--yw", type=float, default=0.05, help="half-width of the horizontal blend band")
    ap.add_argument("--search", type=float, nargs=2, default=(0.40, 0.60))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    im = Image.open(args.source).convert("RGB")
    w, h = im.size
    a = np.asarray(im, dtype=np.float32)
    rb = a[..., 0] - a[..., 2]

    x_seam = _find_seam(rb, 0, int(w * args.search[0]), int(w * args.search[1]))
    y_seam = _find_seam(rb, 1, int(h * args.search[0]), int(h * args.search[1]))
    print(f"{args.source}: {w}x{h}")
    print(f"  vertical seam   at x = {x_seam} ({x_seam / w:.1%} of width)")
    print(f"  horizontal seam at y = {y_seam} ({y_seam / h:.1%} of height)")
    if args.dry_run:
        return 0

    blended = _blend_axis(a, x_seam, w * args.xw, axis=0)
    blended = _blend_axis(blended, y_seam, h * args.yw, axis=1)

    # Only the FLAT floor between painted objects is cross-faded. Wherever the image
    # has real structure (a shelf, a bench, a pool rim) the original pixels win, so an
    # object sitting near the seam stays sharp instead of appearing twice. The local
    # standard deviation of luminance is the structure detector.
    lum = a.mean(axis=2)
    r = max(3, int(min(w, h) * 0.012))
    means = _box_mean(lum, r)
    sqs = _box_mean(lum * lum, r)
    std = np.sqrt(np.clip(sqs - means * means, 0.0, None))
    flat = np.clip(1.0 - std / getattr(args, "structure", 18.0), 0.0, 1.0)[..., None]

    out = a + flat * (blended - a)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(args.output)
    band = np.zeros((h, w), bool)
    band[:, max(0, int(x_seam - w * args.xw)):int(x_seam + w * args.xw)] = True
    band[max(0, int(y_seam - h * args.yw)):int(y_seam + h * args.yw), :] = True
    print(f"  blended band x +/-{args.xw:.1%} of width, y +/-{args.yw:.1%} of height")
    print(f"  structure mask: flat fraction in the bands {flat[band].mean():.2f} "
          f"(1.00 = nothing protected, lower = objects held sharp)")
    print(f"  wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))