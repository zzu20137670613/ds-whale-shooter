/**
 * src/game/scenes/trigger.ts
 * --------------------------------------------------------------------------
 * One-shot region triggers (see `Level.triggers`).
 *
 * The scene hands this controller the level's triggers and the player; each
 * frame it asks whether the player has stepped into a zone that has not fired
 * yet this run. When one has, the reward drop is created **already at rest on
 * its landing spot** — the monster-death path pops drops to a random nearby
 * point, and the juice has to land on the side table, not next to it.
 *
 * The flight is driven from `update(delta)` instead of by a tween: it is a
 * dozen lines of arithmetic over `arcPoint`, it stays testable without a
 * Phaser scene, and it keeps this module off engine APIs that would have to be
 * re-learned for Phaser 4. (An earlier revision drove the arc with
 * `tweens.addCounter` — an API nothing else in this codebase uses.)
 *
 * The record is keyed `level:triggerId` and lives with the run, not the world:
 * `clearSaveData` starts a fresh run, so a new run earns a fresh glass.
 *
 * The beach level owns exactly one: step on the lounger, an Apple Cup pops out,
 * arcs onto the side table, and walking into it refills HP and SP
 * (`iced-juice` is a `full-restore` drop).
 */

import type * as Phaser from 'phaser';

import { arcPoint, armedTriggers, isInsideZone, triggerKey } from '@/lib/levels/logic';
import { useGameStore } from '@/store/game-store';
import type { DropController } from '@/game/drops/drop';
import type { DropSpec } from '@/lib/drops';
import type { Level } from '@/lib/levels/types';
import type { Point } from '@/lib/levels/logic';

type Trigger = NonNullable<Level['triggers']>[number];

/** The only part of the character this controller needs: where it stands. */
interface Positioned {
    body: { position: { x: number; y: number } };
}

/** The bits of a drop this controller touches: its sprite, and the magnet flag. */
interface RewardDrop {
    sprite?: Phaser.GameObjects.Sprite;
    rejected: boolean;
}

/** One glass in the air. */
interface Flight {
    sprite: Phaser.GameObjects.Sprite;
    drop: RewardDrop;
    from: Point;
    to: Point;
    lift: number;
    durationMs: number;
    elapsedMs: number;
}

export class TriggerController {
    private readonly levelId: string;
    private readonly character: Positioned;
    private readonly drops: DropController;
    private readonly getDrop: (id: string) => DropSpec;
    /** Triggers still armed this run, in level order. */
    private readonly armed: Trigger[];
    private readonly flights: Flight[] = [];
    /** Fires when a `travel` trigger is taken. Supplied by the scene. */
    private readonly travelTo?: (sceneId: string) => void;
    /** Whose feet these are — decides whether a `travel` trigger refuses us. */
    private readonly characterId: () => string | null;

    constructor(
        character: Positioned,
        levelId: string,
        triggers: readonly Trigger[] | undefined,
        drops: DropController,
        getDrop: (id: string) => DropSpec,
        travelTo?: (sceneId: string) => void,
        characterId?: () => string | null,
    ) {
        this.character = character;
        this.levelId = levelId;
        this.drops = drops;
        this.getDrop = getDrop;
        this.travelTo = travelTo;
        this.characterId = characterId ?? (() => useGameStore.getState().selectedCharacterId);
        this.armed = armedTriggers(levelId, triggers, useGameStore.getState().usedTriggers);
        // A level that ships triggers whose every one has already fired produces
        // no effect and no error at all, which reads exactly like a bug. Say so
        // once at load instead of leaving the player walking in circles.
        if (triggers && triggers.length > 0 && this.armed.length === 0) {
            console.info(
                `[trigger] ${levelId}: every trigger already fired this run - clear the save to earn them again`,
            );
        }
    }

    /** Advance every glass in the air, then fire armed triggers underfoot. */
    update(deltaMs: number): void {
        this.advanceFlights(deltaMs);

        if (this.armed.length === 0) return;
        const { x, y } = this.character.body.position;
        for (let i = this.armed.length - 1; i >= 0; i--) {
            const trigger = this.armed[i];
            if (!isInsideZone(trigger.zone, x, y)) continue;
            // A door that refuses this character stays armed: standing on it as
            // Claude must not burn the entrance for the rest of the save.
            if ('travel' in trigger && this.refuses(trigger)) continue;
            this.armed.splice(i, 1);
            useGameStore.getState().markTriggerUsed(triggerKey(this.levelId, trigger.id));
            try {
                this.fire(trigger);
            } catch (error) {
                // A trigger whose reward cannot be built must not take the game
                // loop down with it. It is already spent, so log once and move on.
                console.error(`[trigger] ${triggerKey(this.levelId, trigger.id)} failed`, error);
            }
        }
    }

    /** True when this trigger's door is closed to whoever is walking. */
    private refuses(trigger: Trigger): boolean {
        if (!('travel' in trigger)) return false;
        const who = this.characterId();
        if (!who) return false;
        return trigger.travel.excludeCharacters.includes(who);
    }

    destroy(): void {
        this.flights.length = 0;
        this.armed.length = 0;
    }

    private advanceFlights(deltaMs: number): void {
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const flight = this.flights[i];
            flight.elapsedMs += deltaMs;
            const t = Math.min(flight.elapsedMs / flight.durationMs, 1);
            const point = arcPoint(flight.from, flight.to, t, flight.lift);
            flight.sprite.setPosition(point.x, point.y);
            flight.sprite.setDepth(Math.round(point.y));
            if (t < 1) continue;

            // Landed: snap onto the table and let the magnet take over.
            flight.sprite.setPosition(flight.to.x, flight.to.y);
            flight.sprite.setDepth(Math.round(flight.to.y));
            flight.drop.rejected = false;
            this.flights.splice(i, 1);
        }
    }

    private fire(trigger: Trigger): void {
        if ('travel' in trigger) {
            // No drop, no animation: the scene owns what "move to another scene"
            // means (level id, snapshot reset, fade). Without a callback we can
            // only say so — silently doing nothing would look like a dead door.
            if (!this.travelTo) {
                console.warn(
                    `[trigger] ${triggerKey(this.levelId, trigger.id)} is a travel trigger but no handler was wired`,
                );
                return;
            }
            this.travelTo(trigger.travel.targetScene);
            return;
        }

        const { from, to, lift, durationMs } = trigger.spawn;
        const drop: RewardDrop = this.drops.spawnLanded(
            this.getDrop(trigger.spawn.type),
            to.x,
            to.y,
        );
        const sprite = drop.sprite;
        // Without a sprite (headless, or the art never loaded) the drop still
        // exists, but it is invisible - and invisible is indistinguishable from
        // broken, so say it out loud.
        if (!sprite) {
            console.warn(
                `[trigger] ${trigger.spawn.type} has no sprite on the ground; the reward is there but invisible`,
            );
            return;
        }

        // The magnet would otherwise yank the glass out of its arc the moment
        // the player is inside its radius. Released the frame the arc lands.
        drop.rejected = true;
        sprite.setPosition(from.x, from.y);
        sprite.setDepth(Math.round(from.y));
        this.flights.push({ sprite, drop, from, to, lift, durationMs, elapsedMs: 0 });
    }
}
