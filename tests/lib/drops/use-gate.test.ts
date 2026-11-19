/**
 * tests/lib/drops/use-gate.test.ts
 * --------------------------------------------------------------------------
 * A drink must never look like a dead button.
 *
 * The owner, in the boss level with the auto-swapped 鲸鱼娘:
 *   `boss战里的鲸鱼娘一定要可以使用前面累积的道具，听了你的描述我怀疑你是给专门锁了`
 *
 * He was right about the lock, though it was not on purpose: `useFromBackpack` consulted
 * `effectWouldDoSomething` before every use, and that answers "would this change a number".
 * At full HP a 冰镇果汁 answers no - so the click returned silently with the item still in the
 * bag. Nothing looked broken, because nothing happened at all.
 *
 * The rule now: only an AMMO box may refuse (there must be a gun to feed). HP/SP items are
 * always usable; healing clamps at max, so the worst case is a wasted drink, not a locked UI.
 */

import { describe, expect, it } from 'vitest';

import { effectWouldDoSomething } from '@/lib/drops/use-check';

const FULL = { hp: 300, maxHp: 300, sp: 100, maxSp: 100 };
const HURT = { hp: 120, maxHp: 300, sp: 100, maxSp: 100 };

const juice = { type: 'full-restore' as const };
const shard = { type: 'instant' as const, hp: 25, sp: 0 };
const ammo = { type: 'refill-ammo' as const, ammoFraction: 1 };
const material = { type: 'material' as const, sellPrice: 5 };

describe('what the gate itself says', () => {
    it('says a full-restore would do nothing at full vitals - that part stays true', () => {
        expect(effectWouldDoSomething(juice, FULL, { hasRangedWeapon: true })).toBe(false);
    });

    it('says it would help when something is missing', () => {
        expect(effectWouldDoSomething(juice, HURT, { hasRangedWeapon: true })).toBe(true);
        expect(effectWouldDoSomething(shard, HURT, { hasRangedWeapon: true })).toBe(true);
    });

    it('blocks an ammo box with no gun', () => {
        expect(effectWouldDoSomething(ammo, HURT, { hasRangedWeapon: false })).toBe(false);
    });

    it('never allows materials or weapons from the bag', () => {
        expect(effectWouldDoSomething(material, HURT, { hasRangedWeapon: true })).toBe(false);
        expect(
            effectWouldDoSomething({ type: 'weapon', weaponId: 'x' } as never, HURT, { hasRangedWeapon: true }),
        ).toBe(false);
    });
});

describe('which effects the backpack refuses', () => {
    // Restored on the owner's call: `之前满血满状态拒绝是对的`. The gate applies to every
    // effect again, so a drink at full vitals is refused instead of wasted.
    const refused = (
        effect: Parameters<typeof effectWouldDoSomething>[0],
        vitals = FULL,
        ammo = { hasRangedWeapon: true },
    ) => !effectWouldDoSomething(effect, vitals, ammo);

    it('refuses an ammo box with nothing to feed', () => {
        expect(refused(ammo, FULL, { hasRangedWeapon: false })).toBe(true);
    });

    it('refuses a drink at full vitals', () => {
        expect(refused(juice)).toBe(true);
        expect(refused(shard)).toBe(true);
    });

    it('allows the same drink once something is missing', () => {
        expect(refused(juice, HURT)).toBe(false);
        expect(refused(shard, HURT)).toBe(false);
    });

    it('refuses materials and weapons from the bag', () => {
        expect(refused(material, HURT)).toBe(true);
    });

    it('the boss-fight numbers follow the same rule - no special case', () => {
        const whale = { hp: 315, maxHp: 315, sp: 285, maxSp: 285 };
        expect(refused(juice, whale)).toBe(true);
        expect(refused(juice, { ...whale, hp: 300 })).toBe(false);
    });
});
