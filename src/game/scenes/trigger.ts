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

import { PLAY_STORY_VIDEO_EVENT } from '@/lib/constants';
import { arcPoint, isInsideZone, triggerKey } from '@/lib/levels/logic';
import { EventBus } from '@/lib/events/bus';
import { CHARACTER_SAY_EVENT } from '@/lib/inventory/events';
import { useGameStore } from '@/store/game-store';
import type { DropController } from '@/game/drops/drop';
import type { DropSpec } from '@/lib/drops';
import type { WeaponSpec } from '@/lib/weapons/types';
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
    /** `trigger.line` for whoever is playing: their own override, else the default. */
    private sayTriggerLine(trigger: NonNullable<Level['triggers']>[number]): void {
        const lines = (trigger as { line?: Record<string, string | undefined> }).line;
        if (!lines) return;
        const me = useGameStore.getState().selectedCharacterId ?? '';
        const text = lines[me] ?? lines.default;
        if (!text) return;
        try {
            EventBus.emit(CHARACTER_SAY_EVENT, { text });
        } catch (error) {
            // The line is decoration; the reward is the point. Never let one sink the other.
            console.warn('[trigger] line failed', error);
        }
    }

    private readonly levelId: string;
    private readonly character: Positioned;
    private readonly drops: DropController;
    private readonly getDrop: (id: string) => DropSpec;
    /** Triggers still armed this run, in level order. */
    private readonly armed: Trigger[];
    private readonly flights: Flight[] = [];
    /** Fires when a `travel` trigger is taken. Supplied by the scene. */
    private readonly travelTo?: (sceneId: string) => void;
    /** True once the level's waves are done; gates `travel.requiresClear` doors. */
    private readonly isCleared?: () => boolean;
    /** Whose feet these are — decides whether a trigger refuses us. */
    private readonly characterId: () => string | null;
    /** Weapon lookup, for triggers that drop a weapon. */
    private readonly getWeapon?: (id: string) => WeaponSpec | undefined;

    constructor(
        character: Positioned,
        levelId: string,
        triggers: readonly Trigger[] | undefined,
        drops: DropController,
        getDrop: (id: string) => DropSpec,
        travelTo?: (sceneId: string) => void,
        characterId?: () => string | null,
        getWeapon?: (id: string) => WeaponSpec | undefined,
        isCleared?: () => boolean,
    ) {
        this.character = character;
        this.levelId = levelId;
        this.drops = drops;
        this.getDrop = getDrop;
        this.travelTo = travelTo;
        this.isCleared = isCleared;
        this.characterId = characterId ?? (() => useGameStore.getState().selectedCharacterId);
        this.getWeapon = getWeapon;
        // `perCharacter` triggers key on the character too, so one save can hold one fang
        // per girl rather than one fang total.
        this.armed = (triggers ?? []).filter(
            (trigger) =>
                'travel' in trigger ||
                !useGameStore
                    .getState()
                    .usedTriggers.includes(
                        triggerKey(levelId, trigger.id) +
                            ((trigger as { perCharacter?: boolean }).perCharacter
                                ? `:${this.characterId() ?? ''}`
                                : ''),
                    ),
        );
        // A level that ships triggers whose every one has already fired produces
        // no effect and no error at all, which reads exactly like a bug. Say so
        // once at load instead of leaving the player walking in circles.
        // `?triggerDebug=1` prints which ones this save has already spent, and for whom -
        // a one-shot trigger that already fired looks exactly like a broken one.
        if (typeof window !== 'undefined' && window.location.search.includes('triggerDebug')) {
            const used = useGameStore
                .getState()
                .usedTriggers.filter((k) => k.startsWith(`${levelId}:`));
            console.info(`[trigger] ${levelId} character=${this.characterId() ?? 'none'}`, {
                armed: this.armed.map((t) => t.id),
                spent: used,
            });
        }

        if (triggers && triggers.length > 0 && this.armed.length === 0) {
            // Say WHICH keys are spent. "already fired" without the keys left the owner and
            // me guessing whether the save really held them (`还是没反应`).
            console.info(
                `[trigger] ${levelId}: every trigger already fired this run - clear the save to earn them again`,
                {
                    spent: useGameStore
                        .getState()
                        .usedTriggers.filter((k) => k.startsWith(`${levelId}:`)),
                    wanted: triggers.map((t) => triggerKey(levelId, t.id)),
                },
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
            // A trigger that refuses this character stays armed: standing on it
            // as the wrong character must not burn the reward for the save.
            if (this.refuses(trigger)) continue;
            // A door that wants a cleared map stays armed while monsters are alive - the
            // player can stand on the throne before the four waves are done and nothing
            // should happen.
            // Fail closed: a requiresClear door with no predicate wired is treated as locked,
            // not as open - the opposite default would let the throne skip every wave.
            if (
                'travel' in trigger &&
                trigger.travel.requiresClear &&
                !(this.isCleared?.() ?? false)
            ) {
                continue;
            }
            this.armed.splice(i, 1);
            // One line per fire. A trigger that silently does nothing is
            // indistinguishable from a trigger that never armed, and the owner has had to
            // report that twice (`没有掉下白龙獠牙，也没有触发对话词`).
            console.info(`[trigger] fired ${triggerKey(this.levelId, trigger.id)}`);
            // A `travel` trigger is a DOOR, not a reward. Recording it spent the entrance
            // for the rest of the save: enter the boss level once, die or settle out of it,
            // and the throne never works again (`在亚特兰蒂斯踩龙王宝座时进不去boss关了`).
            // The in-memory splice above still keeps it to one firing per visit.
            if (!('travel' in trigger)) {
                useGameStore
                    .getState()
                    .markTriggerUsed(
                        triggerKey(this.levelId, trigger.id) +
                            ((trigger as { perCharacter?: boolean }).perCharacter
                                ? `:${this.characterId() ?? ''}`
                                : ''),
                    );
            }
            // The cut-scene the trigger declares, if any: 一夜鱼龙舞 plays the moment the player
            // stands on the throne. Emitted BEFORE the reward, deliberately: a drop that cannot be
            // built (unknown weaponId, no sprite, a throwing listener) must not swallow the
            // moment - the owner asked for the video at the throne, not at the fang.
            const video = (trigger as { video?: string }).video;
            if (video) EventBus.emit(PLAY_STORY_VIDEO_EVENT, { src: video });
            try {
                this.fire(trigger);
            } catch (error) {
                // A trigger whose reward cannot be built must not take the game
                // loop down with it. It is already spent, so log once and move on.
                console.error(`[trigger] ${triggerKey(this.levelId, trigger.id)} failed`, error);
            }
        }
    }

    /**
     * True when this character may not fire the trigger.
     *
     * `travel` triggers carry an exclude list; spawn triggers carry an allow
     * list (`onlyCharacters`). A refused trigger stays armed rather than burning
     * itself, so the right character can still earn it later in the same save.
     */
    private refuses(trigger: Trigger): boolean {
        const who = this.characterId();
        if (!who) return false;
        if ('travel' in trigger) return trigger.travel.excludeCharacters.includes(who);
        const only = trigger.onlyCharacters;
        return only ? !only.includes(who) : false;
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

    /**
     * Fly a drop along the same arc the triggers use, from any point to any
     * point. The cat shop's gift needs this because its target is the player's
     * feet, which no authored zone can know in advance.
     */
    launch(
        dropSpec: DropSpec,
        from: Point,
        to: Point,
        lift: number,
        durationMs: number,
        weaponSpec?: WeaponSpec,
    ): void {
        const drop: RewardDrop = weaponSpec
            ? this.drops.spawnWeaponLanded(dropSpec, weaponSpec, to.x, to.y)
            : this.drops.spawnLanded(dropSpec, to.x, to.y);
        const sprite = drop.sprite;
        if (!sprite) {
            console.warn(`[trigger] launch: ${dropSpec.id} has no sprite`);
            return;
        }
        drop.rejected = true;
        sprite.setPosition(from.x, from.y);
        sprite.setDepth(Math.round(from.y));
        this.flights.push({ sprite, drop, from, to, lift, durationMs, elapsedMs: 0 });
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
        const dropSpec = this.getDrop(trigger.spawn.type);
        const weaponSpec = trigger.spawn.weaponId
            ? this.getWeapon?.(trigger.spawn.weaponId)
            : undefined;
        if (trigger.spawn.weaponId && !weaponSpec) {
            console.warn(`[trigger] unknown weaponId: ${trigger.spawn.weaponId}`);
            return;
        }
        const drop: RewardDrop = weaponSpec
            ? this.drops.spawnWeaponLanded(dropSpec, weaponSpec, to.x, to.y)
            : this.drops.spawnLanded(dropSpec, to.x, to.y);
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

        // Say it AFTER the reward exists. Saying it first meant an exception from the line
        // (or from a listener on CHARACTER_SAY_EVENT) aborted `fire()` before the fang was
        // ever spawned - `触发台词了，但是没掉白龙獠牙枪`.
        this.sayTriggerLine(trigger);
    }
}
