# Character sprites

One folder per playable character, plus a sixth group for the epilogue cast.
Each folder holds the sprite sheet declared in `public/data/characters/<id>.yaml`
(`animations.texture`) — so renaming a file means editing that YAML.

The `epilogue/` group is not a character: it is the story NPC (seed) and the three
post-game cats. They are grouped together because they share one source file,
`src/lib/story/epilogue-npcs.ts`, and none of them is selectable in the tavern.

```
assets/image/characters/
  claude/
      claude.png
  deepseek/
      deepseek.png
  epilogue/
      cat-claude.png
      cat-dsh.png
      cat-gpt.png
      seed-npc.png
  gemini/
      gemini.png
  gpt/
      gpt.png
  qwen/
      qwen.png
  raws/
      boss-claude.png
      bunny-girl.png
      claude.png
      deepseek.png
      gpt.png
      kitty.png
      otaku.png
      qwen.png
      seed.png
      wanderer.png
```

`raws/` holds the untouched source art the sheets were cut from; nothing loads from it.
