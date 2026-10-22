# Owner art markings 鈥?the convention

The owner marks a finished block/world plate so the walls and teleporters can be
derived from it. Detection is automated, so the marks must be unambiguous.

## Colour

**Orange `#FF8C00`** 鈥?one opaque pen, straight from the palette, no opacity, no
blur, no anti-aliased brush. It is deliberately far more saturated than anything in
the art (the palest warm tone we paint with is `#E8C87A`), so it can be told apart
from gold roofs and wooden floors by saturation alone.

Do not use it on top of an already annotated image. **Mark the clean plate**: the
detector works by differencing the marked image against the clean one, so any
annotation already in the base shows up as a mark.

## Two shapes, one colour

| Mark | Meaning | Detected as |
| --- | --- | --- |
| **Solid filled blob** | unreachable area (walls go here) | connected region, filled |
| **Hollow circle** | teleporter (centre + ring) | ring of roughly constant stroke width |

A filled blob has no interior hole; a teleporter circle does. That difference is
what the detector keys on, not the colour.

## Rules the owner asked for

- A teleporter circle may be drawn **straddling a wall on purpose** 鈥?half the arc
  over unreachable floor, half over walkable floor. The teleporter's trigger radius
  is then clamped to the largest radius that stays on reachable ground, so the
  coverage always equals "where the player can actually stand".

## Recorded markings

### starry-library (2026-10-21, first orange pass)

Earlier blue-pen pass on the annotated plate, kept as a reference for position:

| Circle | Full-size centre | Ring radius (median) | Outer edge | Connects to |
| --- | --- | --- | --- | --- |
| top-right | (9781, 1124) | 203 | 329 | beach-holiday |
| bottom-left | (758, 5552) | 230 | 323 | gpt-sky-city |

Both previous teleporters (`to-beach` at 2800,1500 and `to-sky-city` at 2800,3328)
are retired by this pass.

### sky-city (2026-10-21)

| Mark | Full-size position | Connects to |
| --- | --- | --- |
| bottom-left teleporter | pending re-mark | starry-library |
| bottom-right teleporter | pending re-mark | dsh-atlantis |
## Atlantis pass (2026-10-22)

Two separate mask exports, which is the cleanest form this pipeline can take:

- `world/atlantis-walls.png` - solid red `#F30D0D` on black, red = unreachable.
- `world/atlantis-teleporters.png` - solid yellow `#DCF410` on black, yellow = portal discs.

Read straight from the colours, no base-image diff needed. Walls regenerated with
`scripts/walls-from-art.py --from-mask` (240 rects + the 4 world edges); the two
portal discs are carved 340 px wide so no 32 px cell rect can cover them.

Lesson: two separate mask files beat one annotated plate every time. Ask for them.
