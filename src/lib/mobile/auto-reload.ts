/**
 * src/lib/mobile/auto-reload.ts
 * --------------------------------------------------------------------------
 * There is no R key on a phone, so reloading has to happen on its own.
 *
 * The owner: `换弹功能在移动端做成自动化，脱战5s自动换弹`.
 *
 * The timer measures **combat**, not the magazine: firing, taking a hit, or casting the skill
 * all count as combat, and the clock restarts on each. Five seconds after the last of those,
 * the active weapon tops itself up - if it needs it and is not already reloading.
 *
 * **Walking is not combat.** The owner was explicit: `移动也算脱战，不开火、挨打、放技能就行`.
 * Running around a cleared room with a half-empty clip still fills it, which is the whole point
 * of the rule - you should not have to stand still to get your magazine back.
 *
 * Pure on purpose: the character controller owns "when", this owns "whether", and the rule
 * stays testable without a scene.
 */

/** How long the player may go without acting before the magazine fills itself. */
export const MOBILE_AUTO_RELOAD_IDLE_MS = 5000;

/**
 * What happened this frame that counts as combat.
 *
 * Movement is deliberately absent: there is no `moved` flag, so no future call site can
 * accidentally make walking reset the clock.
 */
export interface CombatSignals {
    /** A shot went out (or was attempted with the trigger held). */
    fired: boolean;
    /** She took a hit. */
    hit: boolean;
    /** The skill fired. */
    cast: boolean;
}

/**
 * The combat clock after this frame.
 *
 * One place owns the rule: any signal, and the clock jumps to `now`; otherwise it keeps the
 * value it had, no matter how much she ran around.
 */
export function nextCombatClock(previous: number, now: number, signals: CombatSignals): number {
    return signals.fired || signals.hit || signals.cast ? now : previous;
}

/** Marks the last moment the player was in combat - the one-shot form of `nextCombatClock`. */
export function markCombat(now: number): number {
    return now;
}

/** Idle time since the clock was set, clamped at 0 for out-of-order frames. */
export function idleMsSince(lastCombatAt: number, now: number): number {
    return Math.max(0, now - lastCombatAt);
}

export interface AutoReloadCheck {
    /** When combat last happened (`markCombat`). */
    lastCombatAt: number;
    now: number;
    ammo: number;
    maxAmmo: number;
    reloading: boolean;
}

/**
 * Should the weapon reload itself this frame?
 *
 * All four conditions are required:
 *   - a full magazine is never touched (a reload mid-fight would be a downgrade),
 *   - an in-flight reload is not restarted (that would reset the timer forever),
 *   - the melee case is excluded by `maxAmmo <= 1` - a sword has no magazine,
 *   - and the idle window has to have passed.
 */
export function shouldAutoReload(check: AutoReloadCheck): boolean {
    if (check.reloading) return false;
    if (check.maxAmmo <= 1) return false;
    if (check.ammo >= check.maxAmmo) return false;
    return idleMsSince(check.lastCombatAt, check.now) >= MOBILE_AUTO_RELOAD_IDLE_MS;
}