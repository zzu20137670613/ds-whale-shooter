/**
 * src/lib/levels/actor-scale.ts
 * --------------------------------------------------------------------------
 * How big a character should LOOK in a given level.
 *
 * The sheets are all drawn at the same authored scale (~190px tall), but the level
 * backgrounds are not: the tavern's chairs imply a 500px human, the dev cabin's desk
 * chair implies something even larger, and the beach's palms happen to match the
 * sheets as drawn. A 1:1 sprite in those rooms reads as a doll on a stage.
 *
 * This is purely visual. Bodies, hitboxes and every gameplay number stay on the
 * sheet's authored scale — see `resolveActorScaleMultiplier` in
 * `game/characters/logic.ts`.
 */

import { TAVERN_ACTOR_SCALE } from '@/lib/constants';

/**
 * The dev cabin's chair, monitors and mug imply a person roughly 620px tall against a
 * sheet figure of ~190px. 2.4 leaves her slightly smaller than the seated developer,
 * which is what the room's own proportions ask for.
 */
export const DEV_CABIN_ACTOR_SCALE = 2.4;

const BY_LEVEL: Record<string, number> = {
    tavern: TAVERN_ACTOR_SCALE,
    'dev-cabin': DEV_CABIN_ACTOR_SCALE,
};

/** The visual multiplier for a level; 1 (the sheet's own scale) when unlisted. */
export function actorScaleFor(levelId: string): number {
    return BY_LEVEL[levelId] ?? 1;
}