/**
 * src/game/monsters/region-spawner.ts
 * --------------------------------------------------------------------------
 * Follow-spawn runtime: walk into a quadrant, and nine monsters arrive.
 *
 * Only levels that declare `spawner` in their YAML get one of these - today the
 * library, the sky city and Atlantis. The beach and the hidden levels keep their
 * hand-placed waves, untouched.
 *
 * Flow:
 *   player enters quadrant N (first `waves` fresh quadrants of THIS visit only)
 *     -> after `delayMs`, spawn 4 near (2 melee + 2 ranged) + 5 on the edges
 *
 * Nothing is persisted: the owner asked for the waves to fire on every entry
 * (`每次进入都刷怪`), so a reloaded or re-entered level starts the fight again. The
 * in-memory `triggered` set still stops one quadrant from refilling while you stand in it.
 *   monsters land where walls allow; a refused point retries a few times and then
 *   falls back to spawning anyway (a monster inside a wall still paths out).
 *
 * `isDone()` tells the scene whether every wave has already fired, which is what
 * stops the exit portal from appearing the instant the level loads.
 */

import type { Level } from '@/lib/levels';
import type { MonsterSpec } from '@/lib/monsters';
import { pullFromWorldCorners } from '@/lib/monsters/region';
import {
    edgeSpawnPoints,
    nearRingPoints,
    quadrantIndexAt,
    quadrantRects,
    waveComposition,
    type Point,
} from '@/lib/monsters/region';
import type { WeaponSpec } from '@/lib/weapons';

/** The spawner block exactly as the level schema produces it. */
export type RegionSpawnerConfig = NonNullable<Level['spawner']>;

/** How many times a blocked point is re-rolled before giving up on it. */
const PLACEMENT_RETRIES = 12;

/** How far outside a no-spawn rectangle a pushed-out point lands. */
const EXCLUSION_MARGIN_PX = 48;

export interface RegionSpawnerDeps {
    /** Level id, for the persisted "already triggered" keys. */
    levelId: string;
    /** Level size in px, from the YAML's `imageSize`. */
    imageSize: { width: number; height: number };
    config: RegionSpawnerConfig;
    getMonster: (type: string) => MonsterSpec | undefined;
    getWeapon: (weaponId: string) => WeaponSpec | undefined;
    /** Spawn one monster; the controller owns the actual entity. */
    spawn: (spec: MonsterSpec, weapon: WeaponSpec, x: number, y: number, waveId: string) => void;
    /**
     * True when a point cannot host a monster: inside a wall, or in a part of the
     * map the player cannot walk to (a sealed room). Wall-free is not enough.
     */
    isBlocked: (x: number, y: number) => boolean;
    /**
     * Nearest point a monster *can* stand on, used when every re-roll fails.
     * Optional: without it the spawner falls back to the player's own position.
     */
    nearestSpawnable?: (x: number, y: number) => { x: number; y: number } | null;
    /** Injected so tests are deterministic. */
    rng?: () => number;
    now?: () => number;
}

interface PendingWave {
    regionIndex: number;
    fireAt: number;
}

export class RegionSpawner {
    private readonly deps: RegionSpawnerDeps;
    private readonly rects: { x: number; y: number; width: number; height: number }[];
    private readonly rng: () => number;
    private readonly now: () => number;
    private pending: PendingWave | null = null;
    /** Quadrant indices already triggered on this visit. */
    private triggered = new Set<number>();
    private wavesFired = 0;

    constructor(deps: RegionSpawnerDeps) {
        this.deps = deps;
        this.rng = deps.rng ?? Math.random;
        this.now = deps.now ?? (() => performance.now());
        this.rects = quadrantRects(deps.imageSize.width, deps.imageSize.height);
    }

    /**
     * Call once per frame with the player's position. Registers a new quadrant and
     * fires the queued wave when its delay has elapsed.
     */
    update(playerX: number, playerY: number): void {
        const now = this.now();

        // Queue a wave for a quadrant nobody has entered before.
        if (!this.pending && this.wavesFired < this.deps.config.waves) {
            const index = quadrantIndexAt(playerX, playerY, this.rects);
            if (index >= 0 && !this.triggered.has(index)) {
                // NOT remembered yet: a quadrant only counts once its wave actually lands.
                // Marking on entry lost the wave whenever the player left inside the delay.
                this.pending = {
                    regionIndex: index,
                    // Anchored to the quadrant the player entered: leaving before
                    // the delay still spawns the wave back there.
                    fireAt: now + this.deps.config.delayMs,
                };
            }
        }

        if (!this.pending) return;
        if (now < this.pending.fireAt) return;

        const regionIndex = this.pending.regionIndex;
        this.pending = null;
        this.wavesFired += 1;
        this.triggered.add(regionIndex);
        this.spawnWave(regionIndex, playerX, playerY);
    }

    /** Every configured wave has been spawned; the level can now be "cleared". */
    isDone(): boolean {
        return this.wavesFired >= this.deps.config.waves && this.pending === null;
    }

    /** Exposed for the debug panel / tests. */
    get firedWaves(): number {
        return this.wavesFired;
    }

    private spawnWave(regionIndex: number, playerX: number, playerY: number): void {
        const { config } = this.deps;
        const rect = this.rects[regionIndex];
        // 最后一波（第 `waves` 波）可以按关卡配置换怪换配比；前几波沿用固定骨架。
        // 主人 2026-11-12：`把三大关中每一关最后一波（第三波）的怪物配比调出来`。
        const isFinalWave = this.wavesFired >= config.waves;
        const slots = waveComposition(isFinalWave ? config.finalWave : undefined);

        const nearSlots = slots.filter((slot) => slot.distance === 'near');
        const farSlots = slots.filter((slot) => slot.distance === 'far');

        const nearPoints = this.resolvePoints(
            nearRingPoints(
                nearSlots.length,
                { x: playerX, y: playerY },
                config.near.minDistance,
                config.near.maxDistance,
                this.rng,
            ),
        );
        const farPoints = this.resolvePoints(
            edgeSpawnPoints(rect, farSlots.length, config.far.edgeInset).map((point) =>
                pullFromWorldCorners(
                    point,
                    this.deps.imageSize,
                    config.far.cornerInset ?? 0,
                ),
            ),
        );

        const waveId = `region-${regionIndex}`;
        nearSlots.forEach((slot, index) => {
            this.spawnOne(slot.role, nearPoints[index % nearPoints.length], waveId, slot.monsterId);
        });
        farSlots.forEach((slot, index) => {
            this.spawnOne(slot.role, farPoints[index % farPoints.length], waveId, slot.monsterId);
        });
    }

    private spawnOne(
        role: 'melee' | 'ranged',
        point: Point,
        waveId: string,
        monsterId?: string,
    ): void {
        const type = monsterId ?? this.pickMonster(role);
        if (!type) return;
        const base = this.deps.getMonster(type);
        if (!base) {
            // A missing spec used to be a silent `return`: the wave still counted as fired,
            // `isDone()` went true and the exit portal opened over an unfinished map. Shout
            // instead, so the next prefetch gap is visible in the console.
            console.warn(`[spawner] no spec for monster "${type}" — check collectMonsterIds`);
            return;
        }
        // A melee wave has to survive the walk in. The multiplier is per level, so the same
        // monster costs different amounts of ammo on different maps.
        // A named slot is a hand-placed guest (守关 boss): its own YAML health stands,
        // because the wave multipliers belong to the level's ordinary trash pools.
        const everyMonster = this.deps.config.hpMultiplier ?? 1;
        const meleeOnly = role === 'melee' ? (this.deps.config.meleeHpMultiplier ?? 1) : 1;
        const multiplier = monsterId ? 1 : everyMonster * meleeOnly;
        const spec =
            multiplier === 1 ? base : { ...base, hp: Math.round(base.hp * multiplier) };
        const weapon = this.deps.getWeapon(spec.weaponId);
        if (!weapon) return;
        this.deps.spawn(spec, weapon, point.x, point.y, waveId);
    }

    /**
     * Pick a monster for a role. Levels list one id per role today; the rotation
     * keeps a future two-monster pool from always sending the first one.
     */
    private pickMonster(role: 'melee' | 'ranged'): string | undefined {
        const pool = this.deps.config.pool[role];
        if (!pool || pool.length === 0) {
            // Fall back to the other role rather than spawning nothing, so an
            // under-specified level still produces a full wave.
            const other = role === 'melee' ? this.deps.config.pool.ranged : this.deps.config.pool.melee;
            return other && other.length > 0 ? other[0] : undefined;
        }
        if (pool.length === 1) return pool[0];
        return pool[Math.floor(this.rng() * pool.length) % pool.length];
    }

    /** Is this point inside one of the level's no-spawn rectangles? */
    private inExclusion(x: number, y: number): boolean {
        return (this.deps.config.exclude ?? []).some(
            (zone) =>
                x >= zone.x &&
                x <= zone.x + zone.width &&
                y >= zone.y &&
                y <= zone.y + zone.height,
        );
    }

    /**
     * Push a point out of the level's no-spawn rectangles.
     *
     * Deliberately not a re-roll: the roof band is thousands of px wide, and a random nudge
     * inside it would mostly land back inside it. Moving to the nearest edge always terminates.
     * Edges that would leave the world are skipped - a roof that starts at y=0 cannot be
     * escaped upwards, so those points go under it instead.
     */
    private outsideExclusions(point: Point): Point {
        const { width, height } = this.deps.imageSize;
        let out = point;
        for (const zone of this.deps.config.exclude ?? []) {
            if (!this.inExclusion(out.x, out.y)) continue;
            const exits = [
                { at: zone.y + zone.height + EXCLUSION_MARGIN_PX, axis: 'y' as const, x: out.x },
                { at: zone.y - EXCLUSION_MARGIN_PX, axis: 'y' as const, x: out.x },
                { at: zone.x - EXCLUSION_MARGIN_PX, axis: 'x' as const, y: out.y },
                { at: zone.x + zone.width + EXCLUSION_MARGIN_PX, axis: 'x' as const, y: out.y },
            ].map((edge) => ({
                edge,
                distance:
                    edge.axis === 'y' ? Math.abs(edge.at - out.y) : Math.abs(edge.at - out.x),
                inWorld:
                    edge.axis === 'y'
                        ? edge.at > 16 && edge.at < height - 16
                        : edge.at > 16 && edge.at < width - 16,
            }));
            const usable = exits.filter((e) => e.inWorld).sort((a, b) => a.distance - b.distance);
            const pick = usable[0];
            if (!pick) continue;
            out =
                pick.edge.axis === 'y'
                    ? { x: out.x, y: pick.edge.at }
                    : { x: pick.edge.at, y: out.y };
        }
        return out;
    }

    /** Re-roll points that land in a wall, then accept whatever is left. */
    private resolvePoints(points: Point[]): Point[] {
        const { width, height } = this.deps.imageSize;
        return points.map((raw) => {
            const point = this.outsideExclusions(raw);
            let candidate = point;
            for (let attempt = 0; attempt < PLACEMENT_RETRIES; attempt++) {
                const clamped = {
                    x: Math.min(Math.max(candidate.x, 16), width - 16),
                    y: Math.min(Math.max(candidate.y, 16), height - 16),
                };
                if (
                    !this.inExclusion(clamped.x, clamped.y) &&
                    !this.deps.isBlocked(clamped.x, clamped.y)
                ) {
                    return clamped;
                }
                // Nudge outwards from the original point, then retry.
                candidate = {
                    x: candidate.x + (this.rng() - 0.5) * 220,
                    y: candidate.y + (this.rng() - 0.5) * 220,
                };
            }
            // Every re-roll failed: snap to the closest reachable cell so the
            // monster is never dropped somewhere it can only walk into a wall.
            const clamped = {
                x: Math.min(Math.max(candidate.x, 16), width - 16),
                y: Math.min(Math.max(candidate.y, 16), height - 16),
            };
            const snapped = this.deps.nearestSpawnable?.(clamped.x, clamped.y);
            // The reachable-cell snap knows about walls, not about roofs.
            return this.outsideExclusions(snapped ?? clamped);
        });
    }
}
