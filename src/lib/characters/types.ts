/**
 * src/lib/characters/types.ts
 * --------------------------------------------------------------------------
 * Character base stats. One YAML per character.
 *
 *   id              — required; matches the filename and is verified by
 *                     the loader (mismatch throws)
 *   hp / sp         — base pools at full health/stamina
 *   moveSpeed       — px/sec top-down
 *   spRegenMs       — time to refill SP from 0 to max
 *   body            — physical body dimensions (Matter rectangle)
 *   dodge           — Space-dodge parameters (SP cost, speed, timing)
 *   anims           — named animation tracks: idle / walk / run / dodge.
 *                     `run` is the sprint (held Shift), and one is only needed
 *                     if the sheet has a run row — otherwise sprints walk.
 *   hotbar          — starting weapon IDs in display order
 *                    (mutable in memory: future pickups swap entries)
 *
 * Types are derived from `./schema.ts` via `z.infer` — single source
 * of truth shared with runtime validation.
 */

import type { z } from 'zod';

import type { CharacterIndexSchema, CharacterSpecSchema, CharacterUpgradeSchema } from './schema';

export type CharacterSpec = z.infer<typeof CharacterSpecSchema>;
export type SpriteSpec = NonNullable<CharacterSpec['sprite']>;
export type AnimSpec = NonNullable<CharacterSpec['anims']>[string];
/** One tavern upgrade ladder (costs + stat effect). */
export type CharacterUpgrade = z.infer<typeof CharacterUpgradeSchema>;

/** Ordered manifest of all characters. */
export type CharacterIndex = z.infer<typeof CharacterIndexSchema>;
