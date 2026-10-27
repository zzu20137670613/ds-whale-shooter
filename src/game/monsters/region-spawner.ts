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
 *   player enters quadrant N (first `waves` fresh quadrants only)
 *     -> remember it (persisted, so a reload never re-farms a cleared quadrant)
 *     -> after `delayMs`, spawn 4 near (2 melee + 2 ranged) + 5 on the edges
 *   monsters land where walls allow; a refused point retries a few times and then
 *   falls back to spawning anyway (a monster inside a wall still paths out).
 *
 * `isDone()` tells the scene whether every wave has already fired, which is what
 * stops the exit portal from appearing the instant the level loads.
 */

import type { Level } from '@/lib/levels';
import type { MonsterSpec } from '@/lib/monsters';
import {
    edgeSpawnPoints,
    nearRingPoints,
    quadrantIndexAt,
    quadrantRects,
    waveComposition,
    type Point,
} from '@/lib/monsters/region';
import type { WeaponSpec } from '@/lib/weapons';
import { useGameStore } from '@/store/game-store';

/** The spawner block exactly as the level schema produces it. */
export type RegionSpawnerConfig = NonNullable<Level['spawner']>;

/** How many times a blocked point is re-rolled before giving up on it. */
const PLACEMENT_RETRIES = 12;

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
    /** Quadrant indices already triggered this run (including from the save). */
    private triggered: Set<number>;
    private wavesFired = 0;

    constructor(deps: RegionSpawnerDeps) {
        this.deps = deps;
        this.rng = deps.rng ?? Math.random;
        this.now = deps.now ?? (() => performance.now());
        this.rects = quadrantRects(deps.imageSize.width, deps.imageSize.height);
        this.triggered = new Set(this.restoreTriggered());
        this.wavesFired = this.triggered.size;
    }

    /** Persisted keys look like `starry-library:2`. */
    private restoreTriggered(): number[] {
        const prefix = `${this.deps.levelId}:`;
        const saved = useGameStore.getState().spawnedRegions.filter((key) =>
            key.startsWith(prefix),
        );
        return saved.map((key) => Number(key.slice(prefix.length))).filter((n) => !isNaN(n));
    }

    private remember(regionIndex: number): void {
        this.triggered.add(regionIndex);
        useGameStore.getState().markRegionSpawned(`${this.deps.levelId}:${regionIndex}`);
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
                this.remember(index);
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
        const slots = waveComposition();

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
            edgeSpawnPoints(rect, farSlots.length, config.far.edgeInset),
        );

        const waveId = `region-${regionIndex}`;
        nearSlots.forEach((slot, index) => {
            this.spawnOne(slot.role, nearPoints[index % nearPoints.length], waveId);
        });
        farSlots.forEach((slot, index) => {
            this.spawnOne(slot.role, farPoints[index % farPoints.length], waveId);
        });
    }

    private spawnOne(role: 'melee' | 'ranged', point: Point, waveId: string): void {
        const type = this.pickMonster(role);
        if (!type) return;
        const spec = this.deps.getMonster(type);
        if (!spec) return;
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

    /** Re-roll points that land in a wall, then accept whatever is left. */
    private resolvePoints(points: Point[]): Point[] {
        const { width, height } = this.deps.imageSize;
        return points.map((point) => {
            let candidate = point;
            for (let attempt = 0; attempt < PLACEMENT_RETRIES; attempt++) {
                const clamped = {
                    x: Math.min(Math.max(candidate.x, 16), width - 16),
                    y: Math.min(Math.max(candidate.y, 16), height - 16),
                };
                if (!this.deps.isBlocked(clamped.x, clamped.y)) return clamped;
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
            return snapped ?? clamped;
        });
    }
}
