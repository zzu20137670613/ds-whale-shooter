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
    PET_SUSPEND_GRACE_MS,
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
/** When we sent `suspend`, for the grace window below. 0 = never. */
let suspendedAt = 0;

/** Whether this page hid the pet and therefore owes it a `resume`. */
export function hasSuspendedPet(): boolean {
    return suspendedByUs;
}

/** Tests only — the real app never needs to forget this. */
export function resetPetLifetime(): void {
    suspendedByUs = false;
    suspendedAt = 0;
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
    suspendedAt = suspended ? Date.now() : 0;

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

    // Still inside her 1.4s line: leave her alone. Waking her now would cut the sentence
    // off and shove the window back in the player's face. She auto-resumes on her own
    // (ten-minute timer, plus the tray icon), so skipping costs nothing but a rare wait.
    if (suspendedAt > 0 && Date.now() - suspendedAt < PET_SUSPEND_GRACE_MS) {
        suspendedByUs = false;
        suspendedAt = 0;
        return false;
    }
    const ok = await resumePet(deps);
    // Clear the flag either way: if the call failed, her ten-minute auto-resume
    // and the tray icon are the safety net, and retrying forever would keep
    // firing requests at a closed port.
    suspendedByUs = false;
    suspendedAt = 0;
    return ok;
}
