/**
 * src/lib/drops/auto-use.ts
 * --------------------------------------------------------------------------
 * 生命碎片 drinks itself when it would actually be worth something.
 *
 * The owner's rule: picking up an HP Shard with 25 or more HP missing should heal on the
 * spot instead of landing in the bag. Below that it goes to the bag as before - a shard
 * that tops you off by 6 points is better saved for after the next fight.
 *
 * The threshold is the shard's own heal amount, so the rule reads as "it would heal
 * fully" rather than a number that has to be kept in sync with the YAML.
 */

/** Only this drop auto-consumes. */
export const HP_SHARD_ID = 'hp-shard';

/** What one shard heals, from `public/data/drops/hp-shard.yaml`. */
export const HP_SHARD_HEAL = 25;

/**
 * Whether a picked-up shard should heal immediately.
 *
 * @param hp      current health
 * @param maxHp   her maximum health
 * @param heal    how much this shard is worth (defaults to the authored 25)
 */
export function shouldAutoUseHpShard(
    hp: number,
    maxHp: number,
    heal: number = HP_SHARD_HEAL,
): boolean {
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || !Number.isFinite(heal)) return false;
    const missing = maxHp - hp;
    return missing >= heal && missing > 0;
}