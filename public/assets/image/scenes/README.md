# Level backgrounds

One folder per level, named after the level id in `public/data/levels/`. Multi-plate
levels keep their numbered plates together (`*-1`, `*-2`, ...) so the running order
is obvious.

Paths are declared in each level YAML (`background:` and `backgroundBlocks[].texture`).

```
assets/image/scenes/
  beach-holiday/
      beach-holiday.png
  dev-cabin/
      dev-cabin.png
  dsh-atlantis/
      atlantis-1-wreck.png
      atlantis-2-memory.png
      atlantis-3-regent.png
      atlantis-4-coronation.png
  gpt-sky-city/
      sky-city-1-landing.png
      sky-city-2-gate.png
      sky-city-3-pavilion.png
      sky-city-4-throne.png
  hidden-whale/
      hidden-whale-blank.png
  raws/
      dsh-atlantis.png
      gpt-sky-city.png
      sunlit-henge.png
  starry-library/
      starry-library-1-counter.png
      starry-library-2-maze.png
      starry-library-3-terrace.png
      starry-library-4-scroll.png
  tavern/
      tavern.png
  warhammer-redeem/
      warhammer-1-ruins.png
      warhammer-2-starsea.png
      warhammer-3-courtyard.png
      warhammer-4-alley.png
      warhammer-ending-walkout.jpg
      warhammer-first-meeting.png
```

`raws/` is an archive, not a load path: nothing in it is referenced by a level YAML.
It holds the full-map plates the levels were cut from, plus one unused draft.
Move a plate back out of `raws/` before pointing a YAML at it.
