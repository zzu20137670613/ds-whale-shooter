import { Suspense, lazy, useEffect } from 'react';

import { PhaserGame } from '@/PhaserGame';
import { ComicOverlay } from '@/components/hud/comic-overlay';
import { GameHUDLayer } from '@/components/hud/game-hud-layer';
import { PixelCrosshair } from '@/components/hud/pixel-crosshair';
import { SettlementOverlay } from '@/components/hud/settlement-overlay';
import { ShopPanel } from '@/components/hud/shop-panel';
import { TouchControls } from '@/components/hud/touch-controls';
import { EventBus } from '@/lib/events/bus';
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

function App() {
    const tavernCleared = useGameStore((s) => s.tavernCleared);
    const merchantReady = useGameStore((s) => s.merchantReady);

    // The shop's "return home" button asks for a walk back to the seaside
    // pavilion. `resolveAndRestart` keeps the run (HP, weapons, money) —
    // `restartAtTavern` would wipe it back to character select.
    useEffect(() => {
        const handler = () => void resolveAndRestart('tavern');
        EventBus.on(RETURN_TO_PAVILION_EVENT, handler);
        return () => EventBus.off(RETURN_TO_PAVILION_EVENT, handler);
    }, []);

    // Preview hooks, so the opening and the ending can be looked at without
    // playing to them: ?comic=warhammer-redeem and ?settlement=754000 (ms).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const comic = params.get('comic');
        if (comic) useGameStore.getState().openComicIntro(comic);
        const settlement = params.get('settlement');
        if (settlement) useGameStore.getState().openSettlement(Number(settlement) || 754_000);
    }, []);

    return (
        // Layout lives in index.css (#app). No Tailwind utilities here:
        // they would out-rank the forced-landscape media query.
        <div id="app">
            <PhaserGame />
            <GameHUDLayer />
            {!tavernCleared && (
                <Suspense fallback={null}>
                    <TavernHud />
                </Suspense>
            )}
            {/* The shop follows the mysterious merchant now: it mounts when she
                is standing on the junction, not while the tavern is open. */}
            {merchantReady && <ShopPanel />}
            <Suspense fallback={null}>
                <EditorPanel />
            </Suspense>
            <ComicOverlay />
            <SettlementOverlay />
            <PixelCrosshair />
            {tavernCleared && <TouchControls />}
        </div>
    );
}

export default App;
