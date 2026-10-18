import { describe, expect, it, vi } from 'vitest';

import type { DropSpec } from '@/lib/drops';

import { planDropEffect } from '@/game/drops/logic';

const mkSinks = () => ({
    heal: vi.fn(),
    refillAmmo: vi.fn(),
    fullRestore: vi.fn(),
    onWeaponPickup: vi.fn(),
});

describe('drops/logic — planDropEffect', () => {
    it('instant → heal(hp, sp)', () => {
        const sinks = mkSinks();
        const spec: DropSpec = {
            id: 'hp-shard',
            name: 'HP Shard',
            kind: 'static',
            visual: { size: 18, tint: 0x22c55e },
            effect: { type: 'instant', hp: 25, sp: 0 },
        };
        planDropEffect(spec, sinks);
        expect(sinks.heal).toHaveBeenCalledWith(25, 0);
        expect(sinks.refillAmmo).not.toHaveBeenCalled();
        expect(sinks.onWeaponPickup).not.toHaveBeenCalled();
    });

    it('full-restore -> fullRestore()', () => {

        const sinks = mkSinks();

        const spec: DropSpec = {

            id: 'beach-drink',

            name: 'Beach Drink',

            kind: 'static',

            visual: { size: 20, tint: 0x38bdf8 },

            effect: { type: 'full-restore' },

        };

        planDropEffect(spec, sinks);

        expect(sinks.fullRestore).toHaveBeenCalledTimes(1);

        expect(sinks.heal).not.toHaveBeenCalled();

    });


    it('instant with sp only', () => {
        const sinks = mkSinks();
        const spec: DropSpec = {
            id: 'sp-fragment',
            name: 'SP',
            kind: 'static',
            visual: { size: 18, tint: 0x22c55e },
            effect: { type: 'instant', hp: 0, sp: 30 },
        };
        planDropEffect(spec, sinks);
        expect(sinks.heal).toHaveBeenCalledWith(0, 30);
    });

    it('refill-ammo → refillAmmo(fraction)', () => {
        const sinks = mkSinks();
        const spec: DropSpec = {
            id: 'ammo-cache',
            name: 'Ammo',
            kind: 'static',
            visual: { size: 18, tint: 0xfacc15 },
            effect: { type: 'refill-ammo', ammoFraction: 0.3 },
        };
        planDropEffect(spec, sinks);
        expect(sinks.refillAmmo).toHaveBeenCalledWith(0.3);
    });

    it('weapon → onWeaponPickup + returns requestWeaponSwap', () => {
        const sinks = mkSinks();
        const spec: DropSpec = {
            id: 'shotgun-pickup',
            name: 'Shotgun',
            kind: 'static',
            visual: { size: 18, tint: 0x60a5fa },
            effect: { type: 'weapon', weaponId: 'shotgun' },
        };
        const result = planDropEffect(spec, sinks);
        expect(sinks.onWeaponPickup).toHaveBeenCalledWith('shotgun');
        expect(result.requestWeaponSwap).toBe('shotgun');
    });
});
