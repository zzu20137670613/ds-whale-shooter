/**
 * src/lib/combat/float-number.ts
 * --------------------------------------------------------------------------
 * Which heal/damage deltas deserve a floating number, and how to print them.
 *
 * HP regen calls `heal()` once per frame with a fraction of a point. Spawning a number for
 * each of those filled the screen with `+0.036666666666666666` sixty times a second - the
 * owner saw a crawling digit soup beside the name plate and reported it as a bug. Anything
 * below one point is trickle, not an event; and a number that does show has to be an integer,
 * because a float tail is unreadable at 12 px.
 */

/** A delta smaller than this is regen tick noise, not something to announce. */
export const MIN_FLOAT_DELTA = 1;

/** True when this delta is worth a floating combat number. */
export function shouldShowFloat(delta: number): boolean {
    return Number.isFinite(delta) && Math.abs(delta) >= MIN_FLOAT_DELTA;
}

/** The magnitude as a whole number - no decimal tail, no sign (the colour carries that). */
export function formatFloatAmount(delta: number): string {
    if (!Number.isFinite(delta)) return '0';
    return String(Math.round(Math.abs(delta)));
}