/**
 * src/lib/pet/lifetime.ts
 * --------------------------------------------------------------------------
 * When the pet is put away and when it comes back.
 *
 * The rule that matters: **resume only what we suspended.** The bridge is one
 * process-wide pet, and this game is not its only caller — 第七世's tray icon
 * and hotkey can wake it too. If we blindly POST `resume` on exit, a player who
 * had already hidden the pet themselves gets it popping up because they closed
 * *our* window.
 *
 * `suspendedByUs` is intentionally module state: it is one fact about one pet,
 * not something any component owns, and it must survive React re-mounts (which
 * happen on every scene change).
 */

import {
    type PetDeps,
    PET_FALLBACK_BONUS_PERCENT,
    probePet,
    resumePet,
    suspendPet,
} from '@/lib/pet/bridge';

export interface PetBonus {
    percent: number;
    source: 'pet' | 'fallback';
    label: string;
    /** True when this run actually hid the pet. */
    suspended: boolean;
}

let suspendedByUs = false;

/** Whether this page hid the pet and therefore owes it a `resume`. */
export function hasSuspendedPet(): boolean {
    return suspendedByUs;
}

/** Tests only — the real app never needs to forget this. */
export function resetPetLifetime(): void {
    suspendedByUs = false;
}

/**
 * Everything that happens once, when a run starts: read the pet's tier, then
 * put her away for the duration.
 *
 * Order matters. `probePet` must come first: suspending the pet before reading
 * her level would race her own state machine for nothing, and on an older build
 * (no `/level`) we would have hidden a pet that gives no bonus at all.
 */
export async function beginPetSession(deps: PetDeps): Promise<PetBonus> {
    const probe = await probePet(deps);

    if (!probe.ok) {
        // Not installed, asleep, or too old to report a level. No pet to hide,
        // and the buff still applies - see PET_FALLBACK_BONUS_PERCENT.
        return {
            percent: PET_FALLBACK_BONUS_PERCENT,
            source: 'fallback',
            label: probe.reason === 'no-level' ? '桌宠（旧版本）' : '桌宠',
            suspended: false,
        };
    }

    const suspended = await suspendPet(deps);
    suspendedByUs = suspended;

    return {
        percent: probe.level.bonusPercent,
        source: 'pet',
        label: probe.level.label,
        suspended,
    };
}

/**
 * Give the pet back, if we took her. Returns whether a resume was attempted, so
 * the caller can log a one-liner instead of guessing.
 */
export async function endPetSession(deps: PetDeps): Promise<boolean> {
    if (!suspendedByUs) return false;
    const ok = await resumePet(deps);
    // Clear the flag either way: if the call failed, her ten-minute auto-resume
    // and the tray icon are the safety net, and retrying forever would keep
    // firing requests at a closed port.
    suspendedByUs = false;
    return ok;
}
