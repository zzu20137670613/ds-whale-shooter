import { describe, expect, it } from 'vitest';

import { merchantSpawnPosition, usesMerchant } from '@/lib/merchant/logic';

describe('merchant logic', () => {
    describe('usesMerchant', () => {
        it('hosts the merchant wherever a level fields waves', () => {
            // After the 2x2 split a painted level is ONE block, so "four blocks" no longer
            // describes them; the merchant follows the spawner instead.
            expect(usesMerchant({ spawner: { waves: 1 } })).toBe(true);
            expect(usesMerchant({ spawner: { waves: 3 } })).toBe(true);
        });

        it('skips the places with no fight', () => {
            expect(usesMerchant({})).toBe(false);
            expect(usesMerchant({ backgroundBlocks: [{}, {}, {}, {}] })).toBe(false);
        });
    });

    describe('merchantSpawnPosition', () => {
        it('stands on the junction of the four blocks', () => {
            expect(
                merchantSpawnPosition({ width: 11008, height: 6144 }),
            ).toEqual({ x: 5504, y: 3072 });
        });

        it('rounds to whole pixels', () => {
            expect(
                merchantSpawnPosition({ width: 2753, height: 1537 }),
            ).toEqual({ x: 1377, y: 769 });
        });
    });
});