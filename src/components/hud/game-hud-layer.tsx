import React from 'react';
import { CharacterHUDOverlay } from './character-hud-overlay';
import { DeathOverlay } from './death-overlay';
import { VictoryOverlay } from './victory-overlay';
import { SettingsOverlay } from './settings-overlay';
import { WeaponHUDOverlay } from './weapon-hud-overlay';
import { SceneHubOverlay } from './scene-hub-overlay';
import { ComboOverlay } from './combo-overlay';
import { HurtVignetteOverlay } from './hurt-vignette-overlay';
import { DebugReadout } from './debug-readout';
import { NoticeToast } from './notice-toast';
import { HudErrorBoundary } from './hud-error-boundary';
import { LocaleToggle } from './locale-toggle';
import { SaveHotkeys } from './save-hotkeys';
import { SaveToast } from './save-toast';
import { MoneyHud } from './money-hud';

import { useHudScale } from '@/lib/use-hud-scale';

/**
 * Wrapper that gives every HUD overlay one coordinate space.
 *
 * The layer covers the whole app box — not the canvas rect. The canvas
 * now *covers* its container and overflows it, and anchoring HUD chrome
 * to an overflowing box pushes panels off-screen. Children anchor to the
 * layer's edges with plain `absolute top/left/right/bottom`, so the
 * layer is laid out at `viewport / scale` and then scaled back down:
 * corners land in the real corners at any zoom and every child shrinks
 * uniformly.
 *
 * Being inside `#app` means the forced-landscape rotation is inherited
 * for free — `appViewport()` already reports the rotated dimensions.
 */
export const GameHUDLayer: React.FC = () => {
    const { scale, width, height, left, top } = useHudScale();

    const style: React.CSSProperties =
        width > 0
            ? {
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width / scale}px`,
                  height: `${height / scale}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
              }
            : { position: 'absolute', inset: 0 };

    return (
        <div style={style} className="pointer-events-none overflow-hidden z-10">
            {/* Each overlay is isolated: a render crash in one costs that panel, not
                the whole screen. A black page caused by a missing import is how this
                earned its place. */}
            <HudErrorBoundary name="hurt-vignette">
                <HurtVignetteOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="scene-hub">
                <SceneHubOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="combo">
                <ComboOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="character">
                <CharacterHUDOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="weapon">
                <WeaponHUDOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="money">
                <MoneyHud />
            </HudErrorBoundary>
            <HudErrorBoundary name="locale">
                <LocaleToggle />
            </HudErrorBoundary>
            <HudErrorBoundary name="debug">
                <DebugReadout flag="spriteDebug" globalKey="__spriteDebug" />
            </HudErrorBoundary>
            <HudErrorBoundary name="save-hotkeys">
                <SaveHotkeys />
            </HudErrorBoundary>
            <HudErrorBoundary name="notice">
                <NoticeToast />
            </HudErrorBoundary>
            <HudErrorBoundary name="save-toast">
                <SaveToast />
            </HudErrorBoundary>
            <HudErrorBoundary name="settings">
                <SettingsOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="death">
                <DeathOverlay />
            </HudErrorBoundary>
            <HudErrorBoundary name="victory">
                <VictoryOverlay />
            </HudErrorBoundary>
        </div>
    );
};
