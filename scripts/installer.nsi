; ─────────────────────────────────────────────────────────────────────────────
; scripts/installer.nsi
;
; The setup.exe for the Windows release.
;
; The portable build (a folder you can run in place) and this installer are two different
; things, and the owner wants the second one: double-click, choose a folder, get shortcuts.
;
; Rules this file follows, each one learned from the galgame side (第七世):
;   - `RequestExecutionLevel user` — installs under %LOCALAPPDATA%, no UAC prompt. Players
;     on a home machine do not have to know an administrator password to play.
;   - The directory page is always shown, with a working "browse" button.
;   - Uninstall removes the game but NEVER touches the save folder
;     (%APPDATA%\深海回响 · 枪火柔情). Deleting a save on uninstall is unforgivable.
;
; Built by `pnpm pack:installer`, which writes `installer-defines.nsh` first.
; ─────────────────────────────────────────────────────────────────────────────

; The defines file is generated per build (paths contain Chinese, and makensis reads the
; script as ANSI unless it finds a BOM - so both files are written as UTF-8 WITH BOM).
!include "installer-defines.nsh"

Unicode true
RequestExecutionLevel user
; NOT solid. A solid archive makes the installer unpack its whole payload into %TEMP% before
; the first page appears, and a 470 MB payload then fails on machines with a small or locked
; temp folder: `Error writing temporary file. Make sure your temp folder is valid.`
SetCompressor lzma

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define GAME_NAME "深海回响 · 枪火柔情"
!define APP_DIR "深海回响 · 枪火柔情"
!define EXE_NAME "深海回响 · 枪火柔情.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ShenHaiHuiXiang"

Name "${GAME_NAME}"
BrandingText "${GAME_NAME}"
OutFile "${OUTFILE}"
; Fallback only: `.onInit` picks the real default below.
InstallDir "$LOCALAPPDATA\Programs\${APP_DIR}"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"

; Where a first install goes when the drive exists.
!define PREFERRED_ROOT "D:\"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${GAME_NAME}"
VIAddVersionKey "FileDescription" "${GAME_NAME} 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "第八世"

; ── Default folder ──────────────────────────────────────────────────────────
; The owner installs to D: every single time and was changing it by hand
; (`我每次都是手动改的`). Three rules, in order:
;   1. upgrading: stay where the last install went;
;   2. first install on a machine with a D: drive: D:\<game>;
;   3. otherwise: %LOCALAPPDATA%\Programs\<game> (needs no admin rights).
; The directory page still lets the player pick anything else.
Function .onInit
    ReadRegStr $0 HKCU "${UNINST_KEY}" "InstallLocation"
    ${If} $0 != ""
        StrCpy $INSTDIR $0
    ${Else}
        ${If} ${FileExists} "${PREFERRED_ROOT}*.*"
            StrCpy $INSTDIR "${PREFERRED_ROOT}${APP_DIR}"
        ${EndIf}
    ${EndIf}
FunctionEnd

!define MUI_ICON "${MUIICON}"
!define MUI_UNICON "${MUIICON}"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

Section "Game" SecGame
    SetOutPath "$INSTDIR"
    ; The whole portable app: the Electron runtime, resources/app and the exe.
    File /r "${SRCDIR}\*.*"

    WriteUninstaller "$INSTDIR\Uninstall.exe"

    CreateDirectory "$SMPROGRAMS\${APP_DIR}"
    CreateShortcut "$SMPROGRAMS\${APP_DIR}\${GAME_NAME}.lnk" "$INSTDIR\${EXE_NAME}"
    CreateShortcut "$SMPROGRAMS\${APP_DIR}\卸载 ${GAME_NAME}.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\${GAME_NAME}.lnk" "$INSTDIR\${EXE_NAME}"

    ; Uninstall entry, so Windows' own "apps" list can remove it.
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${GAME_NAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
    WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE_NAME}"
    WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "第八世"
    WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
    Delete "$DESKTOP\${GAME_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_DIR}\${GAME_NAME}.lnk"
    Delete "$SMPROGRAMS\${APP_DIR}\卸载 ${GAME_NAME}.lnk"
    RMDir "$SMPROGRAMS\${APP_DIR}"

    ; Save data lives in %APPDATA%\${APP_DIR} (Electron userData). It stays on purpose:
    ; uninstalling a game must not throw away the player's run.
    DeleteRegKey HKCU "${UNINST_KEY}"

    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\locales"
    Delete "$INSTDIR\*.dll"
    Delete "$INSTDIR\*.pak"
    Delete "$INSTDIR\*.bin"
    Delete "$INSTDIR\*.dat"
    Delete "$INSTDIR\*.json"
    Delete "$INSTDIR\*.exe"
    Delete "$INSTDIR\LICENSE"
    Delete "$INSTDIR\LICENSES.chromium.html"
    Delete "$INSTDIR\version"
    RMDir "$INSTDIR"
SectionEnd