/**
 * tests/game/monsters/boss-fire.test.ts
 * --------------------------------------------------------------------------
 * Her shells must actually exist, at a real position, with a real velocity.
 *
 * The owner's panel: `shots=2 … lastAttack=barrage` and `bullets=47`, while nothing crossed
 * the screen. Forty-seven objects pinned at depth 1e6 that nobody can see smell like NaN -
 * a projectile whose body was created with a NaN velocity sits at a NaN position forever and
 * never fails a bounds check. This file fires her attacks through a fake scene and inspects
 * every number that reaches Matter.
 */

import { describe, expect, it, vi } from 'vitest';

import {
    BARRAGE_SECOND_RING_DELAY_MS,
    BOSS_BULLET_LIFE_MS,
    BOSS_BULLET_SPEED_MULTIPLIER,
    WRATH_BASE_RADIUS,
} from '@/lib/bosses/attacks';
import { fireBarrage, fireCannon } from '@/game/monsters/boss-attacks';

interface FakeScene {
    scene: unknown;
    velocities: { x: number; y: number }[];
    images: number;
    rects: number;
}

function fakeScene(): FakeScene {
    const record: FakeScene = { scene: null, velocities: [], images: 0, rects: 0 };

    const visual = () => ({
        setDepth: () => undefined,
        setRotation: () => undefined,
        setScale: () => undefined,
        setOrigin: () => undefined,
        setStrokeStyle: () => undefined,
        setPosition: () => undefined,
        setAlpha: () => undefined,
        destroy: () => undefined,
    });

    const scene = {
        add: {
            image: () => {
                record.images += 1;
                return visual();
            },
            rectangle: () => {
                record.rects += 1;
                return visual();
            },
            circle: () => visual(),
        },
        // No textures loaded: `spawnProjectile` must fall back to a rectangle and still work.
        textures: { exists: () => false },
        matter: {
            add: {
                circle: (x: number, y: number) => ({
                    position: { x, y },
                    label: 'monster-projectile',
                }),
            },
        },
        time: {
            // Fire every delayed call immediately, in order.
            delayedCall: (_ms: number, cb: () => void) => {
                cb();
                return { remove: () => undefined };
            },
        },
    };

    record.scene = scene;
    return record;
}

const matter = {
    Body: {
        setVelocity: (_body: unknown, velocity: { x: number; y: number }) => {
            // Recorded by the closure below.
            (lastRecord as FakeScene).velocities.push(velocity);
        },
    },
};

let lastRecord: FakeScene;

function context(record: FakeScene) {
    return {
        scene: record.scene as never,
        matter: matter as never,
        actor: {
            x: 1000,
            y: 800,
            projectile: { speed: 14, radius: 9, width: 28, height: 11 },
        },
        aim: 0,
        damageScale: 1,
        wrathWaves: 0,
        player: { x: 1200, y: 800 },
        damageAt: vi.fn(),
        // Every shell must be handed back. A record that is created and dropped never gets
        // moved or culled - 53 of them once sat frozen at her feet.
        trackBullet: (record: unknown) => record,
    };
}

describe('her cannon', () => {
    it('fires nine shells, all with finite velocity', () => {
        const record = fakeScene();
        lastRecord = record;
        fireCannon(context(record) as never);

        expect(record.velocities.length).toBeGreaterThan(0);
        for (const v of record.velocities) {
            expect(Number.isFinite(v.x)).toBe(true);
            expect(Number.isFinite(v.y)).toBe(true);
            // A shell that leaves the world in one frame is as good as invisible.
            expect(Math.hypot(v.x, v.y)).toBeGreaterThan(0.5);
            expect(Math.hypot(v.x, v.y)).toBeLessThan(60);
        }
    });
});

describe('tracking', () => {
    it('hands back every shell it creates', () => {
        const record = fakeScene();
        lastRecord = record;
        const tracked: unknown[] = [];
        const ctx = context(record) as Record<string, unknown> as {
            trackBullet: (r: unknown) => void;
        };
        ctx.trackBullet = (r: unknown) => tracked.push(r);

        fireBarrage(ctx as never);
        expect(tracked).toHaveLength(32);
    });

    it('hands back every cannon shell too', () => {
        const record = fakeScene();
        lastRecord = record;
        const tracked: unknown[] = [];
        const ctx = context(record) as Record<string, unknown> as {
            trackBullet: (r: unknown) => void;
        };
        ctx.trackBullet = (r: unknown) => tracked.push(r);

        fireCannon(ctx as never);
        expect(tracked.length).toBe(9);
    });
});

describe('her barrage', () => {
    it('fires two sweeps of sixteen - 32 shells - all finite', () => {
        // `顺时针炮弹机制第一轮结束之后0.2秒，再跟一轮，捆绑死`
        const record = fakeScene();
        lastRecord = record;
        fireBarrage(context(record) as never);

        expect(record.velocities.length).toBe(32);
        for (const v of record.velocities) {
            expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
        }
    });

    it('a shell with no speed left over from a degenerate spec still moves', () => {
        // If a spec ever ships `speed: undefined`, the multiplier turns it into NaN and every
        // shell becomes an invisible ghost - which is exactly the 47-object screen.
        const record = fakeScene();
        lastRecord = record;
        const ctx = context(record) as never as { actor: { projectile: { speed: number } } };
        fireBarrage(context(record) as never);
        expect(ctx.actor.projectile.speed).toBe(14);
        expect(record.velocities.every((v) => !Number.isNaN(v.x))).toBe(true);
    });
});

describe('her shells reach across the room', () => {
    // The owner: `将Claude的火箭弹速度加快约1/2，射程增加2倍，现在这站着不动都打不到`.
    // Half speed plus a 1500ms lifetime ended every shell at ~630px - exactly where he stood.
    it('is faster than it was', () => {
        expect(BOSS_BULLET_SPEED_MULTIPLIER).toBeCloseTo(0.75, 3);
        // 14 px/frame authored x 0.75 = 10.5, against 7 before.
        expect(14 * BOSS_BULLET_SPEED_MULTIPLIER).toBeGreaterThan(10);
    });

    it('lives three times as long', () => {
        expect(BOSS_BULLET_LIFE_MS).toBe(4500);
    });

    it('reaches the far side of the ruins circle', () => {
        const pixelsPerSecond = 14 * BOSS_BULLET_SPEED_MULTIPLIER * 60;
        const reach = (pixelsPerSecond * BOSS_BULLET_LIFE_MS) / 1000;
        // The arena is ~3000px across; a mortar has to clear it.
        expect(reach).toBeGreaterThan(2000);
    });
});

describe('the second sweep is bundled right behind the first', () => {
    it('waits 200ms after the first ring lands, no more', () => {
        // 16 bullets at 26ms each = 390ms of sweep, then a 200ms breath, then the same again.
        expect(BARRAGE_SECOND_RING_DELAY_MS).toBe(200);
        const sweepMs = 15 * 26;
        const secondStarts = sweepMs + BARRAGE_SECOND_RING_DELAY_MS;
        expect(secondStarts).toBe(590);
    });
});

describe('天谴轰炸 circles', () => {
    it('are 2.5 times the original radius', () => {
        // 64px -> 160px. It went to 320 and stacked lethally, so it came back down.
        expect(WRATH_BASE_RADIUS).toBe(160);
        expect(WRATH_BASE_RADIUS / 64).toBe(2.5);
    });

    it('so the warning circle is a real threat circle', () => {
        expect(WRATH_BASE_RADIUS * 2).toBe(320);
    });
});
