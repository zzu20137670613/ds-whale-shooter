/**
 * src/game/scenes/trigger.ts
 * --------------------------------------------------------------------------
 * One-shot region triggers (see `Level.triggers`).
 *
 * The scene hands this controller the level's triggers and the player; each
 * frame it asks whether the player has stepped into a zone that has not fired
 * yet this run. When one has, the reward drop is created **already at rest on
 * its landing spot** — the monster-death path would pop it to a random nearby
 * point, and the juice has to land on the side table, not next to it — its
 * sprite is then flown along a small arc from the pop-out point to that spot,
 * and the trigger is recorded as used.
 *
 * The record is keyed `level:triggerId` and lives with the run, not with the
 * world: `clearSaveData` starts a fresh run, so a new run earns a fresh glass.
 *
 * The beach level owns exactly one: step on the lounger, a glass of iced juice
 * pops out, arcs onto the side table, and walking into it refills HP and SP
 * (`beach-drink` is a `full-restore` drop).
 */

import type * as Phaser from 'phaser';

import { DROP_CONFIG } from '@/lib/constants';
import { arcPoint, armedTriggers, isInsideZone, triggerKey } from '@/lib/levels/logic';
import { useGameStore } from '@/store/game-store';
import type { DropController } from '@/game/drops/drop';
import type { DropSpec } from '@/lib/drops';
import type { Level } from '@/lib/levels/types';

type Trigger = NonNullable<Level['triggers']>[number];

/** The only part of the character this controller needs: where it stands. */
interface Positioned {
    body: { position: { x: number; y: number } };
}

export class TriggerController {
    private readonly scene: Phaser.Scene;
    private readonly levelId: string;
    private readonly character: Positioned;
    private readonly drops: DropController;
    private readonly getDrop: (id: string) => DropSpec;
    /** Triggers still armed this run, in level order. */
    private readonly armed: Trigger[];
    private readonly flights: Phaser.Tweens.Tween[] = [];

    constructor(
        scene: Phaser.Scene,
        character: Positioned,
        levelId: string,
        triggers: readonly Trigger[] | undefined,
        drops: DropController,
        getDrop: (id: string) => DropSpec,
    ) {
        this.scene = scene;
        this.character = character;
        this.levelId = levelId;
        this.drops = drops;
        this.getDrop = getDrop;
        this.armed = armedTriggers(levelId, triggers, useGameStore.getState().usedTriggers);
    }

    /** Fire every armed trigger whose zone the player is standing in. */
    update(): void {
        if (this.armed.length === 0) return;
        const { x, y } = this.character.body.position;
        for (let i = this.armed.length - 1; i >= 0; i--) {
            const trigger = this.armed[i];
            if (!isInsideZone(trigger.zone, x, y)) continue;
            this.armed.splice(i, 1);
            useGameStore.getState().markTriggerUsed(triggerKey(this.levelId, trigger.id));
            this.fire(trigger);
        }
    }

    destroy(): void {
        for (const flight of this.flights) flight.stop();
        this.flights.length = 0;
        this.armed.length = 0;
    }

    private fire(trigger: Trigger): void {
        const { from, to, lift, durationMs } = trigger.spawn;
        const drop = this.drops.spawnLanded(this.getDrop(trigger.spawn.type), to.x, to.y);
        const sprite = drop.sprite;
        // Without a sprite (headless, or art missing) the drop is already
        // resting on the table, which is the part that matters. Nothing to fly.
        if (!sprite) return;

        // The magnet would otherwise yank the glass out of its arc the moment
        // the player is inside its radius. Released the frame the arc ends.
        drop.rejected = true;
        sprite.setPosition(from.x, from.y);
        sprite.setDepth(Math.round(from.y));

        // Draw the arc instead of only implying it: the glass is small, the
        // camp sits in palm shade, and a bare tween reads as "nothing
        // happened". Same guide line a monster's dropped loot draws.
        const flightLine = this.scene.add.graphics();
        flightLine.setDepth(Math.round(Math.min(from.y, to.y)) - 1);
        const popConfig = DROP_CONFIG.PARABOLA;
        flightLine.lineStyle(popConfig.LINE_WIDTH, popConfig.LINE_COLOR, popConfig.LINE_ALPHA);
        // The same `arcPoint` the sprite follows, so the line cannot drift
        // from the glass. Segments on purpose: Phaser.Curves would pull the
        // whole engine into any runtime that imports this module.
        const steps = 24;
        flightLine.beginPath();
        flightLine.moveTo(from.x, from.y);
        for (let step = 1; step <= steps; step++) {
            const point = arcPoint(from, to, step / steps, lift);
            flightLine.lineTo(point.x, point.y);
        }
        flightLine.strokePath();

        const tween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: durationMs,
            onUpdate: (tw) => {
                const t = tw.getValue() ?? 1;
                const point = arcPoint(from, to, t, lift);
                sprite.setPosition(point.x, point.y);
                sprite.setDepth(Math.round(point.y));
            },
            onComplete: () => {
                sprite.setPosition(to.x, to.y);
                sprite.setDepth(Math.round(to.y));
                drop.rejected = false;
                this.scene.tweens.add({
                    targets: flightLine,
                    alpha: 0,
                    duration: 160,
                    onComplete: () => flightLine.destroy(),
                });
            },
        });
        this.flights.push(tween);
    }
}
