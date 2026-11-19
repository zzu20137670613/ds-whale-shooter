import React, { useEffect, useRef, useState } from 'react';
import { Backpack, Flame, Sparkles, Zap } from 'lucide-react';

import { BACKPACK_TOGGLE_EVENT } from '@/lib/constants';
import {
    BACKPACK_BUTTON_PX,
    CLUSTER_BOTTOM_PX,
    CLUSTER_GAP_PX,
    DODGE_BUTTON_PX,
    FIRE_BUTTON_PX,
    RIGHT_EDGE_PX,
    SKILL_BUTTON_PX,
    BACKPACK_BOTTOM_PX,
    BACKPACK_RIGHT_PX,
} from '@/lib/hud/mobile-layout';
import { EventBus } from '@/lib/events/bus';
import { isMobileLike, toAppPoint } from '@/lib/mobile';
import { t } from '@/locales';
import { useHudScale } from '@/lib/use-hud-scale';
import { useGameStore } from '@/store/game-store';

/**
 * src/components/hud/TouchControls.tsx
 * --------------------------------------------------------------------------
 * Mobile-only DOM overlay: virtual joystick (bottom-left), the right-thumb cluster
 * [技能] / [闪避] [开火], and a small backpack chip in the top-right corner. The owner
 * specified exactly that layout: `移动端左侧是摇杆，右侧做3个按钮：【开火】【闪避】【技能】`
 * and `背包的话做成一个小背包图标，放右上角`. Pure additive — does not
 * interfere with keyboard/mouse on desktop (not rendered there at all).
 *
 * Wire model: each control owns its pointer stream and emits structured
 * events on `@/lib/events/bus`:
 *
 *   - `mobile:move`        { vx, vy } | null      (joystick, normalised)
 *   - `mobile:firing`      boolean                (FIRE button)
 *   - `mobile:dodge`       boolean                (闪避 button)
 *   - `mobile:skill`       boolean                (技能 button; edge-triggered by the game)
 *
 * High-performance mobile implementation:
 * 1. Strictly hidden during Tavern Character Selection (!tavernCleared)
 *    so tapping character sprites is not intercepted by the joystick catch zone.
 * 2. Anchored strictly to the Phaser game canvas (via useHudScale left/top/width/height)
 *    so buttons and joystick never bleed into letterbox black bars.
 * 3. Uses toAppPoint(clientX, clientY) for correct coordinate mapping under
 *    the CSS 90° rotated layout.
 * 4. High-performance direct DOM transform for the knob on touchmove, bypassing
 *    React state reconciliation for 60/120fps stutter-free dragging.
 */

interface JoystickState {
    pointerId: number;
    centerX: number;
    centerY: number;
    /** Where the finger landed, in client px - kept to recognise a tap. */
    startClientX: number;
    startClientY: number;
    /** `performance.now()` at pointerdown. */
    startedAt: number;
    /** Largest distance the knob travelled, in layer px. */
    maxTravel: number;
}

const JOYSTICK_BASE_PX = 140;
const JOYSTICK_KNOB_PX = 64;
/**
 * The stick now lives in a fixed corner box instead of a catch zone over the whole left half.
 *
 * The owner twice reported the same symptom (`点不到猫猫`): a tap anywhere on the left became
 * "walk", because the zone swallowed it before the canvas saw it. A small box means every other
 * touch is a plain, trusted canvas event again - which is what the game's click zones need.
 */
const JOYSTICK_ZONE_PX = 236;
const DEAD_ZONE = 0.12;
const DEFAULT_LEFT_PX = 24;
const DEFAULT_BOTTOM_PX = 24;

/**
 * A gesture this short and this still is a tap, not a drag.
 *
 * The joystick used to live on a catch zone covering the whole left half, so a tap on a cat
 * inside the dev cabin was swallowed and turned into "walk". The owner: `在行走摇杆不动的情况下，
 * 点击屏幕应该触发点击事件的，现在进入开发者小屋的时候点不到猫猫了`.
 */
const TAP_MAX_TRAVEL_PX = 12;
const TAP_MAX_MS = 350;

export const TouchControls: React.FC = () => {
    const tavernCleared = useGameStore((s) => s.tavernCleared);
    const [visible, setVisible] = useState<boolean>(false);
    const [joystickActive, setJoystickActive] = useState<boolean>(false);

    const joystickRef = useRef<JoystickState | null>(null);
    const knobRef = useRef<HTMLDivElement>(null);
    const firingRef = useRef<boolean>(false);
    const dodgeRef = useRef<boolean>(false);
    const { scale, width, height, left, top } = useHudScale();

    useEffect(() => {
        const evaluate = (): void => setVisible(isMobileLike());
        evaluate();
        window.addEventListener('resize', evaluate);
        return () => window.removeEventListener('resize', evaluate);
    }, []);

    // During Tavern Selection (!tavernCleared), TouchControls must NOT render:
    // 1. Player has not chosen a character yet, so walking/shooting/dodging is inactive.
    // 2. Prevents the touch-joystick catch zone from capturing taps intended for character sprites.
    if (!visible || !tavernCleared) return null;

    const maxOffset = (JOYSTICK_BASE_PX - JOYSTICK_KNOB_PX) / 2;
    const clampOffset = (x: number, y: number) => {
        const len = Math.hypot(x, y);
        if (len === 0) return { x: 0, y: 0 };
        if (len <= maxOffset) return { x, y };
        return { x: (x / len) * maxOffset, y: (y / len) * maxOffset };
    };

    const layerW = width > 0 ? width / scale : 0;
    const layerH = height > 0 ? height / scale : 0;

    // Fixed resting place: bottom-left, a thumb's width in from both edges.
    const stickPos = {
        x: DEFAULT_LEFT_PX,
        y: Math.max(8, layerH - JOYSTICK_BASE_PX - DEFAULT_BOTTOM_PX),
    };

    const handleJoystickStart = (e: React.PointerEvent<HTMLDivElement>): void => {
        // App coordinates (handles CSS 90° rotation):
        const appP = toAppPoint(e.clientX, e.clientY);
        // Canvas-relative coordinates inside scaled HUD layer:
        const layerX = (appP.x - left) / scale;
        const layerY = (appP.y - top) / scale;

        // Right half is reserved for the FIRE/DODGE cluster — ignore taps there
        if (layerX > layerW / 2) return;

        // The zone only exists around the resting stick, so no math is needed to place it.
        joystickRef.current = {
            pointerId: e.pointerId,
            centerX: layerX,
            centerY: layerY,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startedAt: performance.now(),
            maxTravel: 0,
        };
        setJoystickActive(true);
        if (knobRef.current) {
            knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    };

    const handleJoystickMove = (e: React.PointerEvent<HTMLDivElement>): void => {
        const js = joystickRef.current;
        if (!js || js.pointerId !== e.pointerId) return;

        const appP = toAppPoint(e.clientX, e.clientY);
        const layerX = (appP.x - left) / scale;
        const layerY = (appP.y - top) / scale;

        const dx = layerX - js.centerX;
        const dy = layerY - js.centerY;

        const clamped = clampOffset(dx, dy);
        const travel = Math.hypot(dx, dy);
        if (travel > js.maxTravel) js.maxTravel = travel;

        // High-performance direct DOM transform (bypasses React state reconciliation on touchmove)
        if (knobRef.current) {
            knobRef.current.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0px)`;
        }

        const rawLen = Math.hypot(clamped.x, clamped.y);
        if (rawLen / maxOffset < DEAD_ZONE) {
            EventBus.emit('mobile:move', null);
        } else {
            const vx = clamped.x / maxOffset;
            const vy = clamped.y / maxOffset;
            EventBus.emit('mobile:move', { vx, vy });
        }
    };

    const handleJoystickEnd = (e: React.PointerEvent<HTMLDivElement>): void => {
        const js = joystickRef.current;
        if (!js || js.pointerId !== e.pointerId) return;
        joystickRef.current = null;
        if (knobRef.current) {
            knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        }
        setJoystickActive(false);
        EventBus.emit('mobile:move', null);

        // A tap on the playfield must still reach the game: the dev cabin's cats are clicked, not
        // walked into. Re-dispatch the pointer at the same spot on the canvas, which is where the
        // scene listens.
        const wasTap =
            js.maxTravel <= TAP_MAX_TRAVEL_PX && performance.now() - js.startedAt <= TAP_MAX_MS;
        if (!wasTap) return;
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const init: PointerEventInit = {
            bubbles: true,
            cancelable: true,
            clientX: js.startClientX,
            clientY: js.startClientY,
            pointerId: js.pointerId,
            pointerType: 'touch',
            isPrimary: true,
        };
        canvas.dispatchEvent(new PointerEvent('pointerdown', init));
        canvas.dispatchEvent(new PointerEvent('pointerup', init));
        canvas.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: js.startClientX,
                clientY: js.startClientY,
            }),
        );
    };

    const shootDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        firingRef.current = true;
        EventBus.emit('mobile:firing', true);
        try {
            (e.target as Element).setPointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    };
    const shootUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        firingRef.current = false;
        EventBus.emit('mobile:firing', false);
    };
    const dodgeDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        dodgeRef.current = true;
        EventBus.emit('mobile:dodge', true);
        try {
            (e.target as Element).setPointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
    };
    const dodgeUp = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        dodgeRef.current = false;
        EventBus.emit('mobile:dodge', false);
    };
    // One-shot: the game consumes the flag on the next tick and clears it, so holding the
    // button cannot queue a chain of casts.
    const skillDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        EventBus.emit('mobile:skill', true);
    };
    const openBackpack = (e: React.PointerEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        // Through the bus: the overlay owns pausing the scene and the music.
        EventBus.emit(BACKPACK_TOGGLE_EVENT, undefined);
    };

    // The owner: `将开火与闪避+技能对调一下位置，开火在左，闪避+技能在右`.
    // So the right-most thumb rests on 闪避, 开火 sits inboard of it, and 技能 stacks above 闪避.
    const dodgeRight = RIGHT_EDGE_PX;
    const fireRight = dodgeRight + DODGE_BUTTON_PX + CLUSTER_GAP_PX;
    const skillRight = RIGHT_EDGE_PX;
    const skillBottom = CLUSTER_BOTTOM_PX + DODGE_BUTTON_PX + CLUSTER_GAP_PX;
    const makeBtnStyle = (
        w: number,
        h: number,
        right: number,
        bottom: number = CLUSTER_BOTTOM_PX,
    ): React.CSSProperties => ({
        position: 'absolute',
        bottom,
        right,
        width: w,
        height: h,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        touchAction: 'none',
    });

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
        <div
            className="z-30 pointer-events-none select-none touch-none overflow-hidden"
            style={style}
        >
            {/* Catch zone: a corner box, not the whole left half */}
            <div
                className="absolute pointer-events-auto"
                style={{
                    left: 0,
                    bottom: 0,
                    width: JOYSTICK_ZONE_PX,
                    height: JOYSTICK_ZONE_PX,
                    touchAction: 'none',
                }}
                onPointerDown={handleJoystickStart}
                onPointerMove={handleJoystickMove}
                onPointerUp={handleJoystickEnd}
                onPointerCancel={handleJoystickEnd}
                data-testid="touch-joystick-zone"
            />

            {/* Virtual joystick — resting at bottom-left, responsive under thumb when active */}
            <div
                className={`absolute pointer-events-none transition-opacity duration-150 ${
                    joystickActive ? 'opacity-90' : 'opacity-40'
                }`}
                style={{
                    left: stickPos.x,
                    top: stickPos.y,
                    width: JOYSTICK_BASE_PX,
                    height: JOYSTICK_BASE_PX,
                }}
                data-testid="touch-joystick"
            >
                <div
                    className="absolute inset-0 rounded-full border-2 border-amber-400/60 bg-stone-950/40 backdrop-blur-sm"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
                />
                <div
                    ref={knobRef}
                    className="absolute rounded-full bg-amber-400 border-2 border-amber-200 will-change-transform"
                    style={{
                        width: JOYSTICK_KNOB_PX,
                        height: JOYSTICK_KNOB_PX,
                        left: JOYSTICK_BASE_PX / 2 - JOYSTICK_KNOB_PX / 2,
                        top: JOYSTICK_BASE_PX / 2 - JOYSTICK_KNOB_PX / 2,
                        transform: 'translate3d(0px, 0px, 0px)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}
                />
            </div>

            {/* DODGE */}
            <button
                type="button"
                className="absolute pointer-events-auto rounded-full border-2 border-sky-200 bg-gradient-to-b from-sky-400/60 to-sky-600/60 backdrop-blur-sm text-sky-50 flex items-center justify-center active:from-sky-300/70 active:to-sky-500/70 transition-colors"
                style={makeBtnStyle(DODGE_BUTTON_PX, DODGE_BUTTON_PX, dodgeRight)}
                onPointerDown={dodgeDown}
                onPointerUp={dodgeUp}
                onPointerCancel={dodgeUp}
                data-testid="touch-dodge"
                aria-label="Dodge"
            >
                <span className="flex flex-col items-center gap-0.5">
                    <Zap className="size-8 fill-sky-100 stroke-sky-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                    <span className="text-[13px] font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {t('mobile.dodge')}
                    </span>
                </span>
            </button>

            {/* FIRE */}
            <button
                type="button"
                className="absolute pointer-events-auto rounded-full border-2 border-red-200 bg-gradient-to-b from-red-400/60 to-red-600/60 backdrop-blur-sm text-red-50 flex items-center justify-center active:from-red-300/70 active:to-red-500/70 transition-colors"
                style={makeBtnStyle(FIRE_BUTTON_PX, FIRE_BUTTON_PX, fireRight)}
                onPointerDown={shootDown}
                onPointerUp={shootUp}
                onPointerCancel={shootUp}
                data-testid="touch-shoot"
                aria-label="Fire"
            >
                <span className="flex flex-col items-center gap-0.5">
                    <Flame className="size-10 fill-red-100 stroke-red-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
                    <span className="text-[14px] font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {t('mobile.fire')}
                    </span>
                </span>
            </button>
            {/* 技能 — above 闪避, one-shot per press */}
            <button
                type="button"
                className="absolute pointer-events-auto rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-400/60 to-amber-600/60 backdrop-blur-sm text-amber-50 flex items-center justify-center active:from-amber-300/70 active:to-amber-500/70 transition-colors"
                style={makeBtnStyle(SKILL_BUTTON_PX, SKILL_BUTTON_PX, skillRight, skillBottom)}
                onPointerDown={skillDown}
                data-testid="touch-skill"
                aria-label="Skill"
            >
                <span className="flex flex-col items-center gap-0.5">
                    <Sparkles className="size-8 fill-amber-100 stroke-amber-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                    <span className="text-[13px] font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {t('mobile.skill')}
                    </span>
                </span>
            </button>

            {/* 背包 — 技能键左侧。原本在武器4与技能键中间，但那段现在被剩余怪物数 +
                连击数占满，所以挪到技能键左边（主人 2026-11-13 调整右上角顺序之后）。 */}
            <button
                type="button"
                className="absolute pointer-events-auto rounded-lg border-2 border-stone-200/70 bg-stone-950/60 backdrop-blur-sm text-stone-100 flex items-center justify-center active:bg-stone-800/70 transition-colors"
                style={{
                    bottom: BACKPACK_BOTTOM_PX,
                    right: BACKPACK_RIGHT_PX,
                    width: BACKPACK_BUTTON_PX,
                    height: BACKPACK_BUTTON_PX,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    touchAction: 'none',
                }}
                onPointerDown={openBackpack}
                data-testid="touch-backpack"
                aria-label={t('mobile.backpack')}
            >
                <Backpack className="size-6" />
            </button>
        </div>
    );
};
