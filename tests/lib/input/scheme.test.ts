// @vitest-environment happy-dom
/**
 * tests/lib/input/scheme.test.ts
 * --------------------------------------------------------------------------
 * A mobile build aims eight ways and has nothing to switch.
 *
 * The owner: `移动端要默认键盘模式（八向开火，移动端可没鼠标自由选择攻击方向）移动端是没有键鼠操作的，
 * 那么【键鼠操作】与【键盘操作】这两个按钮可以直接干掉`.
 *
 * The first version decided purely from `pointer: coarse`, and the shipped APK proved it wrong:
 * inside the Capacitor shell the emulator still reported a fine pointer, so both buttons stayed
 * on screen. The build flag now wins - the Capacitor app IS the mobile build.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    aimsEightWays,
    defaultInputScheme,
    forcedInputScheme,
} from '@/lib/input/scheme';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const mobile = { mobileBuild: true, coarsePointer: true, anyFinePointer: false };
const desktop = { mobileBuild: false, coarsePointer: false, anyFinePointer: true };

describe('who aims eight ways', () => {
    it('is the mobile build, whatever the pointer claims', () => {
        // The emulator case that broke v1: a mouse-driven webview inside the phone shell.
        expect(aimsEightWays({ ...mobile, coarsePointer: false, anyFinePointer: true })).toBe(
            true,
        );
    });

    it('is a touch device with no fine pointer', () => {
        expect(aimsEightWays(mobile)).toBe(true);
    });

    it('is not a desktop', () => {
        expect(aimsEightWays(desktop)).toBe(false);
    });

    it('is not a laptop with a touchscreen, because its trackpad still aims', () => {
        // Desktop build, coarse touchscreen, but a fine pointer exists -> keeps the switch.
        expect(
            aimsEightWays({ mobileBuild: false, coarsePointer: true, anyFinePointer: true }),
        ).toBe(false);
    });
});

describe('the scheme that device gets', () => {
    it('is the eight-way keyboard scheme on mobile', () => {
        expect(defaultInputScheme(true)).toBe('directional');
    });

    it('is the cursor on desktop', () => {
        expect(defaultInputScheme(false)).toBe('mouse');
    });

    it('is pinned on mobile and free on desktop', () => {
        expect(forcedInputScheme(true)).toBe('directional');
        expect(forcedInputScheme(false)).toBeNull();
    });
});

describe('the wiring', () => {
    it('pins the scheme at boot, so a save carrying `mouse` cannot win', () => {
        expect(read('src', 'App.tsx')).toContain('setInputScheme(forced)');
    });

    it('does not draw the switch on a mobile build', () => {
        const chip = read('src', 'components', 'hud', 'input-scheme-switch.tsx');
        expect(chip).toContain('if (eightWayAim()) return null;');
    });

    it('keeps the switch for everyone else', () => {
        const chip = read('src', 'components', 'hud', 'input-scheme-switch.tsx');
        expect(chip).toContain("t('input.mouse')");
        expect(chip).toContain("t('input.directional')");
    });

    it('reads the flag the Capacitor shell sets', () => {
        expect(read('src', 'lib', 'input', 'scheme.ts')).toContain('__DSH_MOBILE__');
    });
});