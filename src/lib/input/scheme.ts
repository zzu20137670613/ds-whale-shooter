/**
 * src/lib/input/scheme.ts
 * --------------------------------------------------------------------------
 * Which aim scheme a device gets, and whether the player may pick.
 *
 * The owner, for the mobile build: `移动端要默认键盘模式（八向开火，移动端可没鼠标自由选择攻击方向）
 * 移动端是没有键鼠操作的，那么【键鼠操作】与【键盘操作】这两个按钮可以直接干掉`.
 *
 * The rule is capability-based, not user-agent-based: a phone reports a coarse pointer and no
 * hover, a desktop reports a fine pointer. That keeps the decision testable and keeps tablets
 * with a mouse able to choose.
 */

import { isMobileBuild } from '@/lib/mobile';
import type { InputScheme } from '@/store/game-store';

export interface DeviceProfile {
    /** The Capacitor shell sets `window.__DSH_MOBILE__` before the bundle runs. */
    mobileBuild: boolean;
    /** `matchMedia('(pointer: coarse)')` — the primary pointer is a finger. */
    coarsePointer: boolean;
    /** `matchMedia('(any-pointer: fine)')` — a mouse or trackpad exists somewhere. */
    anyFinePointer: boolean;
}

/**
 * Does this player aim with the eight directions she walks?
 *
 * Two ways to say yes, and the build flag comes first for a reason: the Capacitor app IS the
 * mobile build, no matter what the pointer reports. An emulator driven by a mouse, or a phone
 * with a Bluetooth mouse attached, still has no *cursor aim* affordance in the HUD - so
 * trusting `pointer: coarse` alone left the 键鼠操作 / 键盘操作 buttons on screen in the very
 * shell we shipped (`移动端是没有键鼠操作的，那么这两个按钮可以直接干掉`).
 *
 * A laptop with a touchscreen is still a mouse device: a fine pointer exists, so it keeps the
 * switch.
 */
export function aimsEightWays(profile: DeviceProfile): boolean {
    if (profile.mobileBuild) return true;
    return profile.coarsePointer && !profile.anyFinePointer;
}

/** The scheme a device should start on, and fall back to every load. */
export function defaultInputScheme(eightWays: boolean): InputScheme {
    return eightWays ? 'directional' : 'mouse';
}

/** The scheme the device is pinned to, or null when the player may choose. */
export function forcedInputScheme(eightWays: boolean): InputScheme | null {
    return eightWays ? 'directional' : null;
}

/** What this browser/webview is. Read once at boot. */
export function readDeviceProfile(): DeviceProfile {
    return {
        mobileBuild: isMobileBuild(),
        coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
        anyFinePointer: window.matchMedia?.('(any-pointer: fine)').matches ?? false,
    };
}

/** Convenience: this device aims eight ways right now. */
export function eightWayAim(): boolean {
    return aimsEightWays(readDeviceProfile());
}
