import { pickText } from '@/locales';
import { useGameStore } from '@/store/game-store';
import { maxWeaponUpgradeLevel } from '@/lib/weapons/upgrades';
import { isRangedSlot } from '@/lib/weapons/ammo';
import type { WeaponController } from '@/game/weapons/logic';

export class WeaponHud {
    constructor(_scene?: unknown, weapons?: WeaponController) {
        if (weapons) {
            this.draw(weapons, 0);
        }
    }

    draw(weapons: WeaponController, time: number): void {
        // ?ammoDebug=1 in the URL publishes the live reload state for the corner
        // readout. The owner can then tell a dead counter from a dead reload without
        // opening devtools.
        if (typeof window !== 'undefined' && window.location.search.includes('ammoDebug')) {
            (window as unknown as { __weaponDebug?: unknown }).__weaponDebug = {
                now: time,
                ...(weapons.getAmmoDebug?.() ?? {}),
            };
        }
        const activeIdx = weapons.getActiveIndex();
        const active = weapons.getActive();
        const ammo = weapons.getAmmo();
        const max = weapons.getMaxAmmo();
        const reserve = weapons.getReserve();
        const isReloading = weapons.isReloading();
        const reloadProgress = isReloading ? weapons.getReloadProgress(time) : 0;

        const slotCount = weapons.getSlotCount();
        const levels = useGameStore.getState().weaponLevels;
        const slots: Array<{
            id: string;
            name: string;
            ammo: number;
            /** Spare rounds — the weapon card's right-hand number. */
            reserve: number;
            clipSize: number;
            texture?: string;
    /** Degrees the HUD card rotates the art by; -90 unless the weapon opts out. */
    cardRotation: number;
    /** Size multiplier for the card art; 1 unless the art is chunky. */
    cardScale: number;
            /** Upgrades owned and the ladder's length — the `0…max` tag on the card. */
            level: number;
            maxLevel: number;
            melee: boolean;
        }> = [];
        for (let i = 0; i < slotCount; i++) {
            const slotState = weapons.getSlot(i);
            if (!slotState) continue;
            const id = slotState.spec.id ?? `slot-${i}`;
            slots.push({
                id,
                name: pickText(slotState.spec.name, slotState.spec.nameZh),
                ammo: slotState.ammo,
                reserve: slotState.reserve,
                clipSize: slotState.spec.clipSize ?? 1,
                texture: slotState.spec.visual?.texture,
        cardRotation: slotState.spec.visual?.cardRotation ?? -90,
        cardScale: slotState.spec.visual?.cardScale ?? 1,
                level: levels[id] ?? 0,
                maxLevel: maxWeaponUpgradeLevel(slotState.spec),
                // The shop needs to know: a melee slot has no rounds to sell.
                melee: !isRangedSlot(slotState.spec),
            });
        }

        useGameStore.getState().setWeaponStats({
            activeIndex: activeIdx,
            name: active ? pickText(active.name, active.nameZh) : '',
            ammo,
            maxAmmo: max,
            reserve,
            isReloading,
            reloadProgress,
            slots,
        });
    }

    setVisible(visible: boolean): void {
        useGameStore.getState().setHubsVisible(visible);
    }

    destroy(): void {
        // No-op
    }
}
