// @vitest-environment happy-dom
/**
 * tests/store/game-store.test.ts
 * --------------------------------------------------------------------------
 * Economy slice of the UI/save store: the player's money.
 *
 * Money is the tavern shop's currency, earned as a bounty per monster
 * killed (see `monsters/monster.ts` → `kill()`) and spent on upgrades in
 * the tavern. It is persisted, so a spending decision survives a refresh.
 *
 * The final case pins the reset semantics deliberately: dying routes
 * through `restartAtTavern` → `clearSaveData`, so money is wiped with the
 * rest of the save. If that ever needs to become a persistent bank, this
 * test is the place that says so out loud.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { getLocale } from '@/locales';
import { initialGameState, useGameStore } from '@/store/game-store';

describe('game store — money', () => {
    beforeEach(() => {
        useGameStore.setState({ money: 0 });
    });

    it('starts a fresh save with no money', () => {
        expect(initialGameState.money).toBe(0);
    });

    it('accumulates money across bounties', () => {
        useGameStore.getState().addMoney(10);
        useGameStore.getState().addMoney(32);

        expect(useGameStore.getState().money).toBe(42);
    });

    it('ignores non-positive and non-finite bounties', () => {
        const { addMoney } = useGameStore.getState();

        addMoney(0);
        addMoney(-5);
        addMoney(Number.NaN);
        addMoney(Number.POSITIVE_INFINITY);
        addMoney(Number.NEGATIVE_INFINITY);

        expect(useGameStore.getState().money).toBe(0);
    });

    it('keeps money an integer when a fractional bounty arrives', () => {
        useGameStore.getState().addMoney(12.7);

        expect(useGameStore.getState().money).toBe(12);
    });

    it('spendMoney deducts an affordable price and reports success', () => {
        useGameStore.getState().addMoney(100);

        expect(useGameStore.getState().spendMoney(30)).toBe(true);
        expect(useGameStore.getState().money).toBe(70);
    });

    it('spendMoney refuses an unaffordable price and changes nothing', () => {
        useGameStore.getState().addMoney(20);

        expect(useGameStore.getState().spendMoney(25)).toBe(false);
        expect(useGameStore.getState().money).toBe(20);
    });

    it('spendMoney refuses a non-finite price', () => {
        useGameStore.getState().addMoney(20);

        expect(useGameStore.getState().spendMoney(Number.NaN)).toBe(false);
        expect(useGameStore.getState().money).toBe(20);
    });

    it('allows an exactly-affordable price (boundary)', () => {
        useGameStore.getState().addMoney(20);

        expect(useGameStore.getState().spendMoney(20)).toBe(true);
        expect(useGameStore.getState().money).toBe(0);
    });

    it('persists money through partialize', () => {
        useGameStore.getState().addMoney(77);

        const partialize = useGameStore.persist.getOptions().partialize;
        const persisted = partialize?.(useGameStore.getState()) as Record<string, unknown>;

        expect(persisted.money).toBe(77);
    });

    it('wipes money on clearSaveData — death is a full reset, not a bank', () => {
        useGameStore.getState().addMoney(500);
        useGameStore.getState().clearSaveData();

        expect(useGameStore.getState().money).toBe(0);
    });
});

describe('game store — locale', () => {
    it('boots into a locale the i18n runtime already knows', () => {
        expect(['en', 'zh-CN']).toContain(initialGameState.locale);
    });

    it('mirrors setLocale into the i18n runtime', () => {
        useGameStore.getState().setLocale('zh-CN');
        expect(useGameStore.getState().locale).toBe('zh-CN');
        expect(getLocale()).toBe('zh-CN');

        useGameStore.getState().setLocale('en');
        expect(getLocale()).toBe('en');
    });

    it('persists the language choice', () => {
        useGameStore.getState().setLocale('zh-CN');

        const partialize = useGameStore.persist.getOptions().partialize;
        const persisted = partialize?.(useGameStore.getState()) as Record<string, unknown>;

        expect(persisted.locale).toBe('zh-CN');
    });

    it('hands the runtime back to the detected locale on clearSaveData', () => {
        useGameStore.getState().setLocale('en');
        useGameStore.getState().clearSaveData();

        expect(getLocale()).toBe(initialGameState.locale);
    });
});

describe('game store — upgrade ledger', () => {
    beforeEach(() => {
        useGameStore.setState({ upgradeLevels: {} });
    });

    it('records how many levels of an upgrade are owned', () => {
        useGameStore.getState().setUpgradeLevel('armor', 2);

        expect(useGameStore.getState().upgradeLevels.armor).toBe(2);
    });

    it('keeps other upgrades when one changes', () => {
        useGameStore.getState().setUpgradeLevel('armor', 1);
        useGameStore.getState().setUpgradeLevel('agility', 3);

        expect(useGameStore.getState().upgradeLevels).toEqual({ armor: 1, agility: 3 });
    });

    it('floors fractions and clamps nonsense to zero', () => {
        useGameStore.getState().setUpgradeLevel('armor', 2.9);
        useGameStore.getState().setUpgradeLevel('speed', Number.NaN);
        useGameStore.getState().setUpgradeLevel('spirit', -3);

        expect(useGameStore.getState().upgradeLevels).toEqual({
            armor: 2,
            speed: 0,
            spirit: 0,
        });
    });

    it('persists the ledger', () => {
        useGameStore.getState().setUpgradeLevel('luck', 1);

        const partialize = useGameStore.persist.getOptions().partialize;
        const persisted = partialize?.(useGameStore.getState()) as Record<string, unknown>;

        expect(persisted.upgradeLevels).toEqual({ luck: 1 });
    });
});

describe('game store — weapon ledger + ammo refill', () => {
    beforeEach(() => {
        // The store is a module singleton, so state survives between tests.
        // Reset the character ledger too — the case below asserts the two
        // ledgers are separate fields, which only means something if the
        // other one starts empty.
        useGameStore.setState({
            upgradeLevels: {},
            weaponLevels: {},
            slots: [],
            activeWeaponIndex: 0,
            activeAmmo: 0,
            activeMaxAmmo: 0,
        });
    });

    it('records weapon upgrade levels keyed by weapon id', () => {
        useGameStore.getState().setWeaponLevel('shotgun', 2);

        expect(useGameStore.getState().weaponLevels.shotgun).toBe(2);
    });

    it('persists the weapon ledger separately from the character one', () => {
        useGameStore.getState().setWeaponLevel('shotgun', 1);

        const partialize = useGameStore.persist.getOptions().partialize;
        const persisted = partialize?.(useGameStore.getState()) as Record<string, unknown>;

        expect(persisted.weaponLevels).toEqual({ shotgun: 1 });
        expect(persisted.upgradeLevels).toEqual({});
    });

    it('refills every hotbar slot to its clip size', () => {
        useGameStore.setState({
            slots: [
                { id: 'shotgun', name: 'Shotgun', ammo: 1, clipSize: 5 },
                { id: 'rifle', name: 'Rifle', ammo: 0, clipSize: 30 },
            ],
        });

        useGameStore.getState().refillAmmo();

        expect(useGameStore.getState().slots.map((s) => s.ammo)).toEqual([5, 30]);
    });

    it('refreshes the derived active-ammo mirrors so the HUD is not stale', () => {
        useGameStore.setState({
            slots: [{ id: 'shotgun', name: 'Shotgun', ammo: 1, clipSize: 5 }],
            activeWeaponIndex: 0,
            activeAmmo: 1,
            activeMaxAmmo: 5,
        });

        useGameStore.getState().refillAmmo();

        expect(useGameStore.getState().activeAmmo).toBe(5);
        expect(useGameStore.getState().activeMaxAmmo).toBe(5);
    });

    it('copes with an empty hotbar', () => {
        useGameStore.getState().refillAmmo();

        expect(useGameStore.getState().slots).toEqual([]);
    });
});