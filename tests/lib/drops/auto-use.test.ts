/**
 * tests/lib/drops/auto-use.test.ts
 * --------------------------------------------------------------------------
 * 生命碎片 auto-drinks when 25 or more HP is missing, otherwise it goes in the bag.
 */

import { describe, expect, it } from 'vitest';

import { HP_SHARD_HEAL, shouldAutoUseHpShard } from '@/lib/drops/auto-use';

describe('shouldAutoUseHpShard', () => {
    it('drinks when the missing health is exactly the shard value', () => {
        expect(shouldAutoUseHpShard(95, 120)).toBe(true); // 25 missing
    });

    it('drinks when more than a shard is missing', () => {
        expect(shouldAutoUseHpShard(40, 130)).toBe(true);
    });

    it('saves it when a full shard would be wasted', () => {
        expect(shouldAutoUseHpShard(96, 120)).toBe(false); // 24 missing
        expect(shouldAutoUseHpShard(119, 120)).toBe(false);
    });

    it('never drinks at full health', () => {
        expect(shouldAutoUseHpShard(120, 120)).toBe(false);
    });

    it('ignores nonsense numbers instead of healing on a NaN', () => {
        expect(shouldAutoUseHpShard(Number.NaN, 120)).toBe(false);
        expect(shouldAutoUseHpShard(90, Number.NaN)).toBe(false);
    });

    it('ties the threshold to the shard, not to a separate constant', () => {
        // 30 HP missing: a 25-point shard is worth drinking, a 40-point one is not -
        // and that follows the heal value alone, nothing else has to be kept in sync.
        expect(shouldAutoUseHpShard(90, 120, HP_SHARD_HEAL)).toBe(true);
        expect(shouldAutoUseHpShard(90, 120, 40)).toBe(false);
    });
});