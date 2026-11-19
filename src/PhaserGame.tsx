import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import StartGame from '@/game/main';
import { EventBus } from '@/lib/events/bus';
import { installLoopGuard } from '@/lib/game-loop-guard';
import { subscribeCrash } from '@/lib/dev/crash-log';
import { setPhaserGame } from '@/lib/phaser-game';
import { useGameStore } from '@/store/game-store';

export interface IRefPhaserGame {
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps {
    currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

// Module-level cache so React 19 StrictMode's double-invoked effect
// (dev only) doesn't trigger two StartGame() calls and double-fetch every
// asset. The promise is shared across mounts of the same parent.
let cachedGame: Phaser.Game | null = null;
let cachedPromise: Promise<Phaser.Game> | null = null;

// 崩溃横幅的节流状态：同一句报错 1.5 秒内只刷一次界面（每帧都刷会让 React 每帧重渲染）。
let crashUnsubscribe: (() => void) | null = null;
let lastCrashKey = '';
let lastCrashAt = 0;

async function startGameOnce(parent: string): Promise<Phaser.Game> {
    if (cachedGame) return cachedGame;
    if (!cachedPromise) {
        cachedPromise = StartGame(parent).then((g) => {
            cachedGame = g;
            cachedPromise = null;
            return g;
        });
    }
    return cachedPromise;
}

// Tear down on real page exit (HMR / navigation). StrictMode's
// double-unmount is harmless: cachedGame is still alive, only destroyed
// here once.
function teardown(): void {
    if (cachedGame) {
        cachedGame.destroy(true);
        cachedGame = null;
        cachedPromise = null;
    }
    crashUnsubscribe?.();
    crashUnsubscribe = null;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame(
    { currentActiveScene },
    ref,
) {
    const game = useRef<Phaser.Game | null>(null!);

    useLayoutEffect(() => {
        let mounted = true;

        startGameOnce('game-container').then((g) => {
            if (!mounted) return; // StrictMode second mount already won
            game.current = g;
            // Publish for the editor's in-process restart path
            // (src/lib/phaser-game.ts). Runs once after StartGame resolves.
            setPhaserGame(g);
            // 主循环兜底：Phaser 的 RAF 链只在回调跑完之后才预约下一帧，所以回调里抛一次
            // 异常就永久冻住画布（React 还活着 —— 就是主人报的「摇杆能点、界面不动」）。
            // 包住交给 RAF 的那个回调，最坏结果降级成"这一帧白跑"，并把那句话显示出来。
            installLoopGuard(g, (crash) => {
                useGameStore.getState().reportCrash(crash.message, crash.context, crash.stack);
            });
            // 场景 update 里被 try/catch 接住的那些（`scene:update`）同样要露出来：它们不会
            // 冻住画布，但会让画面"停住不动"，看起来一样是卡死。
            crashUnsubscribe = subscribeCrash((record) => {
                const now = Date.now();
                const key = `${record.context}:${record.message}`;
                if (key === lastCrashKey && now - lastCrashAt < 1500) return;
                lastCrashKey = key;
                lastCrashAt = now;
                useGameStore.getState().reportCrash(record.message, record.context, record.stack);
            });
            if (typeof ref === 'function') {
                ref({ game: g, scene: null });
            } else if (ref) {
                ref.current = { game: g, scene: null };
            }
        });

        return () => {
            mounted = false;
            // Don't destroy the game here — cachedGame is module-level and
            // may be in use by the second StrictMode mount. The browser's
            // page lifecycle tears it down via the `pagehide` listener.
        };
    }, [ref]);

    useEffect(() => {
        const onPageHide = (): void => teardown();
        window.addEventListener('pagehide', onPageHide);

        EventBus.on('current-scene-ready', (scene_instance: Phaser.Scene) => {
            // The boot splash in index.html covers everything up to here:
            // bundle download, YAML resolve, Phaser boot, asset load. Now
            // the world is on screen, so fade it out.
            const boot = document.getElementById('boot');
            if (boot) {
                boot.classList.add('boot-done');
                setTimeout(() => boot.remove(), 400); // matches the CSS fade
            }
            if (currentActiveScene && typeof currentActiveScene === 'function') {
                currentActiveScene(scene_instance);
            }
            if (typeof ref === 'function') {
                ref({ game: game.current, scene: scene_instance });
            } else if (ref) {
                ref.current = { game: game.current, scene: scene_instance };
            }
        });

        return () => {
            window.removeEventListener('pagehide', onPageHide);
            EventBus.removeListener('current-scene-ready');
        };
    }, [currentActiveScene, ref]);

    return <div id="game-container"></div>;
});
