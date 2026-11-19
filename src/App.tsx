import { Suspense, lazy, useEffect, useState } from 'react';

import { PhaserGame } from '@/PhaserGame';
import { PrivacyGate } from '@/components/legal/privacy-gate';
import { defaultConsentStorage, grantConsent, hasConsent } from '@/lib/legal/consent';
import { BackpackOverlay } from '@/components/hud/backpack-overlay';
import { ComicOverlay } from '@/components/hud/comic-overlay';
import { DevCabinPanel } from '@/components/hud/dev-cabin-panel';
import { GameHUDLayer } from '@/components/hud/game-hud-layer';
import { PixelCrosshair } from '@/components/hud/pixel-crosshair';
import type { PetBonus } from '@/lib/pet/lifetime';
import { recordCrash } from '@/lib/dev/crash-log';
import { installPetExitHooks, startPetBridge } from '@/lib/pet/boot';
import { PET_BONUS_CHARACTER_ID, mobileBlessing, petBonusAppliesTo } from '@/lib/pet/bonus';
import { readDeviceProfile } from '@/lib/input/scheme';
import { SettlementOverlay } from '@/components/hud/settlement-overlay';
import { StoryVideo } from '@/components/hud/story-video';
import { NicknameDialog } from '@/components/hud/nickname-dialog';
import { SupportOverlay } from '@/components/hud/support-overlay';
import { SeedShopPanel } from '@/components/hud/seed-shop-panel';
import { ShopPanel } from '@/components/hud/shop-panel';
import { TouchControls } from '@/components/hud/touch-controls';
import { EventBus } from '@/lib/events/bus';
import { eightWayAim, forcedInputScheme } from '@/lib/input/scheme';
import { RETURN_TO_PAVILION_EVENT } from '@/lib/merchant/logic';
import { resolveAndRestart } from '@/lib/phaser-game';
import { useGameStore } from '@/store/game-store';

/**
 * Top-level React component.
 *
 * PhaserGame is in the main bundle (it owns the canvas lifecycle).
 * EditorPanel is lazy-loaded so its dependencies — most importantly the
 * ~100KB of react-konva — ship in a separate chunk that is only fetched
 * when the panel actually mounts. Until then the user pays nothing.
 *
 * The editor reads its initial level from `@/lib/levels/current-level`
 * (a tiny module-level singleton the scene writes to) so the lazy
 * chunk can mount after `level-loaded` has already fired without
 * missing the data.
 *
 * CheatPanel lives inside the editor sidebar (see `EditorPanel`) so it
 * shares the same surface — no separate floating widget at the app
 * root.
 *
 * TavernHud is lazy-loaded and only mounted while the tavern scene is
 * active (tavernCleared === false). It receives character-focus events
 * from TavernController via EventBus and shows the selection panel.
 */
const EditorPanel = lazy(() => import('@/editor/panel').then((m) => ({ default: m.EditorPanel })));
const TavernHud = lazy(() =>
    import('@/components/hud/tavern-hud').then((m) => ({ default: m.TavernHud })),
);

function GameApp() {
    const tavernCleared = useGameStore((s) => s.tavernCleared);
    const merchantReady = useGameStore((s) => s.merchantReady);

    // Keep the last few errors on the device. A frozen run leaves no other trace, and the only
    // report is a player saying "it stopped" - see lib/dev/crash-log.
    useEffect(() => {
        const onError = (event: ErrorEvent) =>
            recordCrash(event.error ?? event.message, 'window:error');
        const onRejection = (event: PromiseRejectionEvent) =>
            recordCrash(event.reason, 'window:unhandledrejection');
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);

    // A phone has no cursor, so it has exactly one aim scheme: the eight directions she
    // walks. Decided here, once, so a converted save that still says `mouse` cannot leave a
    // touch device aiming at a pointer that will never move.
    useEffect(() => {
        const forced = forcedInputScheme(eightWayAim());
        if (forced) useGameStore.getState().setInputScheme(forced);
    }, []);

    // The shop's "return home" button asks for a walk back to the seaside
    // pavilion. `resolveAndRestart` keeps the run (HP, weapons, money) —
    // `restartAtTavern` would wipe it back to character select.
    useEffect(() => {
        const handler = () => void resolveAndRestart('tavern');
        EventBus.on(RETURN_TO_PAVILION_EVENT, handler);
        return () => EventBus.off(RETURN_TO_PAVILION_EVENT, handler);
    }, []);

    // The desktop pet: read her tier once, then put her away for the session.
    // The exit hooks give her back. Every call is a no-op when she is not
    // running, so a player without the pet pays nothing but one refused socket.
    //
    // The mobile build has no pet at all, and instead pins the blessing at a fixed
    // percentage for DeepSeek (`移动端没有桌宠联动…做成死值…设为20%，其他人物没有这个buff`).
    // The bridge is skipped entirely there: there is nothing to talk to.
    useEffect(() => {
        const mobile = readDeviceProfile().mobileBuild;
        if (mobile) {
            const bonus = mobileBlessing(mobile, petBonusAppliesTo(PET_BONUS_CHARACTER_ID));
            if (bonus) useGameStore.getState().setPetBonus(bonus);
        }

        const deps = {
            fetcher: (input: string, init?: RequestInit) => fetch(input, init),
            onBonus: (bonus: PetBonus) => useGameStore.getState().setPetBonus(bonus),
        };
        if (!mobile) void startPetBridge(deps);
        return mobile ? () => {} : installPetExitHooks(deps);
    }, []);

    // Preview hooks, so the opening and the ending can be looked at without
    // playing to them: ?comic=warhammer-redeem and ?settlement=754000 (ms).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const comic = params.get('comic');
        if (comic) useGameStore.getState().openComicIntro(comic);
        if (params.get('devmail')) useGameStore.getState().openDevCabin();
        const settlement = params.get('settlement');
        if (settlement) useGameStore.getState().openSettlement(Number(settlement) || 754_000);
    }, []);

    return (
        // Layout lives in index.css (#app). No Tailwind utilities here:
        // they would out-rank the forced-landscape media query.
        <div id="app">
            <PhaserGame />
            <GameHUDLayer />
            <BackpackOverlay />
            {!tavernCleared && (
                <Suspense fallback={null}>
                    <TavernHud />
                </Suspense>
            )}
            {/* The shop follows the mysterious merchant now: it mounts when she
                is standing on the junction, not while the tavern is open. */}
            {merchantReady && <ShopPanel />}
            {/* 创世线：seed 是亭台场景里的精灵（tavern-controller），这里只挂她的商店面板。 */}
            <SeedShopPanel />
            <Suspense fallback={null}>
                <EditorPanel />
            </Suspense>
            <ComicOverlay />
            <DevCabinPanel />
            <SettlementOverlay />
            {/* 过场视频：谁发 PLAY_STORY_VIDEO_EVENT 就播谁，播完发 DONE。 */}
            <StoryVideo />
            <SupportOverlay />
            <NicknameDialog />
            <PixelCrosshair />
            {tavernCleared && <TouchControls />}
        </div>
    );
}

/**
 * Everything the player sees once the privacy notice is out of the way.
 *
 * Split out so the gate can return early without breaking the rules of hooks: the game's hooks
 * only exist in this component, and they are only mounted after consent.
 */
function App() {
    const [consented, setConsented] = useState(() => hasConsent(defaultConsentStorage()));

    if (!consented) {
        return (
            <PrivacyGate
                onAccept={() => {
                    grantConsent(defaultConsentStorage());
                    setConsented(true);
                }}
            />
        );
    }

    return <GameApp />;
}

export default App;
