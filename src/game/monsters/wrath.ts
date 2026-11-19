/**
 * src/game/monsters/wrath.ts
 * --------------------------------------------------------------------------
 * 天谴轰炸 — the ground circles that turn red and explode.
 *
 * Phase 2's signature attack, and the only thing in the game that punishes standing
 * still without a projectile to dodge. Each circle:
 *
 *   1. draws itself like a teleporter rune-ring (a cousin of `scenes/teleporter.ts`,
 *      but independent: a wrath circle is 900ms of life, not a persistent world object);
 *   2. pulses for `fuseMs`, turning red over the last third;
 *   3. flashes, then hands its radius to the caller to apply damage.
 *
 * Radii GROW across a phase (see `entropyRadius`), which is what makes a long phase 2
 * eventually unsurvivable — by design.
 */

import * as Phaser from 'phaser';

import { DEPTH } from '@/lib/constants';

/** Palette: calm rune, then alarm. */
const RING_COLOR = 0x7dd3fc;
const RUNE_COLOR = 0xc4b5fd;
const ALARM_COLOR = 0xef4444;
/**
 * Last stretch of the fuse, in which the circle is red.
 *
 * 320 -> 820 when the fuse went to 2000ms: the owner asked for the extra second to be
 * split evenly, 0.5s more blue and 0.5s more red. Blue is therefore 1180ms.
 */
export const ALARM_MS = 820;

export interface WrathCircleOptions {
    /** Circle centre, world coordinates. */
    x: number;
    y: number;
    /** Explosion radius, before any per-circle growth. */
    radius: number;
    fuseMs: number;
    /** Called once, at the moment it explodes. */
    onExplode: (x: number, y: number, radius: number) => void;
}

/**
 * One circle. Returns a destroy function so a scene shutdown can cancel the fuse
 * instead of firing damage into a dead scene.
 */
export function spawnWrathCircle(scene: Phaser.Scene, options: WrathCircleOptions): () => void {
    const { x, y, radius, fuseMs, onExplode } = options;

    const graphics = scene.add.graphics({ x, y });
    graphics.setDepth(DEPTH.BULLET_TRAIL);

    let elapsed = 0;
    let exploded = false;

    const redraw = (progress: number) => {
        const alarmed = fuseMs - elapsed <= ALARM_MS;
        const ring = alarmed ? ALARM_COLOR : RING_COLOR;
        const rune = alarmed ? ALARM_COLOR : RUNE_COLOR;
        // Pulse faster as it closes: 1.5 cycles a second, four at the end.
        const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2 * (alarmed ? 4 : 1.5));
        const alpha = (alarmed ? 0.95 : 0.75) * (0.55 + pulse * 0.45);

        graphics.clear();

        // Soft fill so the danger zone reads at a glance.
        graphics.fillStyle(ring, 0.08 + pulse * 0.06);
        graphics.fillCircle(0, 0, radius);

        // Outer ring + inner offset ring.
        graphics.lineStyle(3, ring, alpha);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1.5, rune, alpha * 0.75);
        graphics.strokeCircle(0, 0, radius * 0.82);

        // Eight dashes, rotating.
        graphics.lineStyle(2, rune, alpha * 0.9);
        const dashes = 8;
        for (let i = 0; i < dashes; i += 1) {
            const start = (i / dashes) * Math.PI * 2 + progress * 1.2;
            const end = start + (Math.PI / dashes) * 0.7;
            graphics.beginPath();
            graphics.arc(0, 0, radius * 0.66, start, end, false);
            graphics.strokePath();
        }

        // Sixteen ticks around the rim, longer as it gets close.
        graphics.lineStyle(2, ring, alpha);
        const tick = 4 + progress * 5;
        for (let i = 0; i < 16; i += 1) {
            const angle = (i / 16) * Math.PI * 2;
            const inner = radius * 0.92;
            const outer = radius * 0.92 + tick;
            graphics.beginPath();
            graphics.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            graphics.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            graphics.strokePath();
        }

        // The centre dot shrinks to nothing exactly as it blows.
        graphics.fillStyle(ring, 0.5 * (1 - progress));
        graphics.fillCircle(0, 0, Math.max(0, radius * 0.18 * (1 - progress)));
    };

    const explode = () => {
        if (exploded) return;
        exploded = true;

        // A bright flash that expands past the real radius — telegraphs the footprint
        // the damage actually uses, so a near-miss reads as a near-miss.
        const flash = scene.add.graphics({ x, y });
        flash.setDepth(DEPTH.BULLET_TRAIL + 1);
        flash.fillStyle(ALARM_COLOR, 0.55);
        flash.fillCircle(0, 0, radius);
        flash.lineStyle(4, 0xffffff, 0.9);
        flash.strokeCircle(0, 0, radius);

        scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.08,
            duration: 220,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy(),
        });

        graphics.destroy();
        onExplode(x, y, radius);
    };

    const timer = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
            elapsed += 16;
            const progress = Math.min(1, elapsed / fuseMs);
            redraw(progress);
            if (elapsed >= fuseMs) {
                timer.remove();
                explode();
            }
        },
    });

    redraw(0);

    return () => {
        if (exploded) return;
        exploded = true;
        timer.remove();
        graphics.destroy();
    };
}