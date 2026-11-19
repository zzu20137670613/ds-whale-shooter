/**
 * tests/desktop/installer-defaults.test.ts
 * --------------------------------------------------------------------------
 * Where the setup puts the game when nobody says otherwise.
 *
 * The owner: `安装程序默认路径是 C:\\Users\\...\\AppData\\Local\\Programs\\...，这个你能控制吗？
 * 改成默认 D:\\深海回响 · 枪火柔情，我每次都是手动改的`.
 *
 * NSIS resolves it in `.onInit`, so this pins the three rules in order: keep the previous
 * location on an upgrade, prefer D: when that drive exists, and only then fall back to
 * %LOCALAPPDATA% (which needs no administrator rights).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const script = readFileSync(join(process.cwd(), 'scripts', 'installer.nsi'), 'utf8');

describe('the first install', () => {
    it('prefers D:', () => {
        expect(script).toContain('!define PREFERRED_ROOT "D:\\"');
        expect(script).toMatch(
            /\$\{FileExists\} "\$\{PREFERRED_ROOT\}\*\.\*"[\s\S]{0,80}StrCpy \$INSTDIR "\$\{PREFERRED_ROOT\}\$\{APP_DIR\}"/,
        );
    });

    it('falls back to the per-user folder when D: is missing', () => {
        // The InstallDir line is the fallback: `.onInit` overwrites it only when it has a
        // better answer, so a machine without a D: drive still installs without UAC.
        expect(script).toContain('InstallDir "$LOCALAPPDATA\\Programs\\${APP_DIR}"');
    });
});

describe('an upgrade', () => {
    it('stays where the game already is', () => {
        // Reinstalling must not scatter a second copy on another drive.
        expect(script).toMatch(
            /ReadRegStr \$0 HKCU "\$\{UNINST_KEY\}" "InstallLocation"[\s\S]{0,80}\$\{If\} \$0 != ""[\s\S]{0,60}StrCpy \$INSTDIR \$0/,
        );
    });

    it('and the uninstaller clears that key, so a fresh install may choose D: again', () => {
        expect(script).toMatch(/Section "Uninstall"[\s\S]{0,600}DeleteRegKey HKCU "\$\{UNINST_KEY\}"/);
    });
});

describe('the directory page', () => {
    it('is still shown, so the player can override the default', () => {
        expect(script).toContain('!insertmacro MUI_PAGE_DIRECTORY');
    });
});