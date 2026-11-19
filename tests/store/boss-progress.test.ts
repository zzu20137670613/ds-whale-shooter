// @vitest-environment happy-dom
/**
 * tests/store/boss-progress.test.ts
 * --------------------------------------------------------------------------
 * The boss fight must not eat what the player bought.
 *
 * The owner: `打boss之前我明明把各项武器都升到满级了，打完boss出来武器等级没了`.
 *
 * The boss level maxes the panel and every gun - that is deliberate, the fight is
 * calibrated for it. What was wrong is that the maxed values were written straight into the
 * persisted ledgers, so the purchases were gone for good. Now the real ledgers are
 * snapshotted on the way in and restored on the way out.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useGameStore } from '@/store/game-store';

const BEFORE = {
    upgradeLevels: { armor: 3, agility: 2, hp: 4 },
    weaponLevels: { 'whale-cannon': 2, 'fish-spear': 1 },
};

function seed() {
    useGameStore.setState({
        upgradeLevels: { ...BEFORE.upgradeLevels },
        weaponLevels: { ...BEFORE.weaponLevels },
        slots: [
            {
                id: 'whale-cannon',
                name: '鲸娘重炮',
                ammo: 6,
                clipSize: 6,
                reserve: 24,
            },
        ],
        runProgressBackup: null,
    });
}

beforeEach(seed);

describe('entering the boss level', () => {
    it('maxes the ledgers for the fight', () => {
        const state = useGameStore.getState();
        state.stashRunProgress();
        useGameStore.setState({
            upgradeLevels: { armor: 5, agility: 5, hp: 5 },
            weaponLevels: { 'whale-cannon': 4, 'assault-rifle': 3 },
        });

        expect(useGameStore.getState().weaponLevels['whale-cannon']).toBe(4);
        expect(useGameStore.getState().runProgressBackup).not.toBeNull();
    });

    it('keeps the real values in the snapshot, not the maxed ones', () => {
        useGameStore.getState().stashRunProgress();

        expect(useGameStore.getState().runProgressBackup?.weaponLevels).toEqual(
            BEFORE.weaponLevels,
        );
        expect(useGameStore.getState().runProgressBackup?.upgradeLevels).toEqual(
            BEFORE.upgradeLevels,
        );
    });

    it('does not overwrite the snapshot when the fight is entered again', () => {
        const state = useGameStore.getState();
        state.stashRunProgress();
        // Second entry, this time with the maxed values already in place.
        useGameStore.setState({ weaponLevels: { 'whale-cannon': 4 } });
        state.stashRunProgress();

        expect(useGameStore.getState().runProgressBackup?.weaponLevels).toEqual(
            BEFORE.weaponLevels,
        );
    });
});

describe('coming back out', () => {
    it('restores exactly what the player had', () => {
        const state = useGameStore.getState();
        state.stashRunProgress();
        useGameStore.setState({
            upgradeLevels: { armor: 5 },
            weaponLevels: { 'whale-cannon': 4 },
        });

        useGameStore.getState().restoreRunProgress();

        const after = useGameStore.getState();
        expect(after.upgradeLevels).toEqual(BEFORE.upgradeLevels);
        expect(after.weaponLevels).toEqual(BEFORE.weaponLevels);
        expect(after.runProgressBackup).toBeNull();
    });

    it('puts the hotbar back too, so the boss rifle does not linger', () => {
        const state = useGameStore.getState();
        state.stashRunProgress();
        useGameStore.setState({
            slots: [
                ...useGameStore.getState().slots,
                { id: 'assault-rifle', name: '突击步枪', ammo: 30, clipSize: 30, reserve: 90 },
            ],
        });

        useGameStore.getState().restoreRunProgress();

        expect(useGameStore.getState().slots.map((slot) => slot.id)).toEqual(['whale-cannon']);
    });

    it('is a no-op when no boss level was entered', () => {
        useGameStore.getState().restoreRunProgress();

        expect(useGameStore.getState().upgradeLevels).toEqual(BEFORE.upgradeLevels);
        expect(useGameStore.getState().weaponLevels).toEqual(BEFORE.weaponLevels);
    });

    it('survives a save that was snapshotted before the app was closed', () => {
        // The snapshot is persisted, so a player who quits mid-fight still gets their
        // purchases back the next time they walk into a normal level.
        useGameStore.getState().stashRunProgress();
        useGameStore.setState({ weaponLevels: { 'whale-cannon': 4 } });

        useGameStore.getState().restoreRunProgress();

        expect(useGameStore.getState().weaponLevels).toEqual(BEFORE.weaponLevels);
    });
});

describe('the case the owner actually hit', () => {
    it('keeps a fully maxed build fully maxed across the fight', () => {
        // `打完亚特兰蒂斯之后在神秘商人这里就升了满级了` - everything at the top rung, then
        // the boss level, then back to the merchant. The panel must still read 满级.
        const maxed = {
            'arcana-staff': 5,
            'assault-rifle': 5,
            'nashors-tooth': 5,
            'white-dragon-fangs': 5,
        };
        useGameStore.setState({ weaponLevels: { ...maxed }, upgradeLevels: { armor: 5 } });

        useGameStore.getState().stashRunProgress();
        // The boss level rewrites the ledgers with its own set (it also adds the rifle).
        useGameStore.setState({
            weaponLevels: { ...maxed, 'whale-cannon': 4 },
            upgradeLevels: { armor: 5 },
        });
        useGameStore.getState().restoreRunProgress();

        expect(useGameStore.getState().weaponLevels).toEqual(maxed);
        expect(useGameStore.getState().upgradeLevels).toEqual({ armor: 5 });
    });

    it('never writes a zero over a bought level', () => {
        // The screenshot showed 0/5 for three guns that had been upgraded, which is the
        // signature of the old code overwriting the ledger rather than restoring it.
        useGameStore.setState({ weaponLevels: { 'white-dragon-fangs': 5 } });
        useGameStore.getState().stashRunProgress();
        useGameStore.setState({ weaponLevels: {} });
        useGameStore.getState().restoreRunProgress();

        expect(useGameStore.getState().weaponLevels['white-dragon-fangs']).toBe(5);
    });
});