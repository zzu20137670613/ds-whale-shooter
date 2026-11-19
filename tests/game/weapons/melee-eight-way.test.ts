/**
 * tests/game/weapons/melee-eight-way.test.ts
 * --------------------------------------------------------------------------
 * The wiring behind 8-direction melee, not just the maths.
 *
 * `tests/lib/combat/melee-arc.test.ts` proves where the box should go; this file
 * proves `spawnMeleeHitbox` actually puts the Matter sensor there and rotates it.
 * The old code created the box at `y = origin.y` and never touched its angle, so
 * a swing aimed up or diagonally produced a hitbox the player could not see and
 * that nothing could collide with.
 */

import { describe, expect, it } from 'vitest';

import { spawnMeleeHitbox } from '@/game/weapons/weapon';

interface Recorded {
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number | null;
    bodyAdded: boolean;
    graphicsRotations: number[];
}

function harness() {
    const recorded: Recorded = {
        x: Number.NaN,
        y: Number.NaN,
        width: 0,
        height: 0,
        angle: null,
        bodyAdded: false,
        graphicsRotations: [],
    };
    const body = { label: 'player-bullet' };

    const visual = () => ({
        setDepth: () => undefined,
        setRotation: () => undefined,
        setScale: () => undefined,
        setOrigin: () => undefined,
        setAlpha: () => undefined,
        setFlipX: () => undefined,
        destroy: () => undefined,
    });

    const scene = {
        add: {
            image: () => visual(),
            graphics: () => {
                const g = {
                    ...visual(),
                    setPosition: () => g,
                    setRotation: (radians: number) => {
                        recorded.graphicsRotations.push(radians);
                        return g;
                    },
                    lineStyle: () => g,
                    beginPath: () => g,
                    arc: () => g,
                    strokePath: () => g,
                };
                return g;
            },
        },
        textures: { exists: () => false },
        time: { now: 0 },
        tweens: { add: () => undefined },
        matter: {
            world: {
                add: () => {
                    recorded.bodyAdded = true;
                },
                remove: () => undefined,
            },
        },
    };

    const matter = {
        Bodies: {
            rectangle: (x: number, y: number, width: number, height: number) => {
                recorded.x = x;
                recorded.y = y;
                recorded.width = width;
                recorded.height = height;
                return body;
            },
        },
        Body: {
            setAngle: (target: unknown, radians: number) => {
                expect(target).toBe(body);
                recorded.angle = radians;
            },
        },
    };

    return { scene, matter, recorded };
}

const ORIGIN = { x: 400, y: 300 };

function swing(
    angle: number,
    opts: { range?: number; hitWidth?: number } = {},
): Recorded {
    const { scene, matter, recorded } = harness();
    spawnMeleeHitbox(scene as never, matter as never, {
        origin: ORIGIN,
        angle,
        range: opts.range ?? 120,
        hitWidth: opts.hitWidth ?? 60,
        hitHeight: 40,
        damage: 10,
    });
    return recorded;
}

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;
const RIGHT = 0;
const LEFT = Math.PI;

describe('spawnMeleeHitbox puts the sensor in eight directions', () => {
    it('still puts a right swing to the right, on the same row', () => {
        const hit = swing(RIGHT);
        expect(hit.x).toBeCloseTo(ORIGIN.x + 90, 5);
        expect(hit.y).toBeCloseTo(ORIGIN.y, 5);
        expect(hit.angle).toBeCloseTo(0, 5);
        expect(hit.bodyAdded).toBe(true);
    });

    it('puts a left swing to the left', () => {
        const hit = swing(LEFT);
        expect(hit.x).toBeCloseTo(ORIGIN.x - 90, 5);
        expect(hit.y).toBeCloseTo(ORIGIN.y, 5);
    });

    it('puts an up swing ABOVE the attacker - the old code could not', () => {
        const hit = swing(UP);
        expect(hit.x).toBeCloseTo(ORIGIN.x, 5);
        expect(hit.y).toBeCloseTo(ORIGIN.y - 90, 5);
        expect(hit.angle).toBeCloseTo(UP, 5);
    });

    it('puts a down swing BELOW the attacker', () => {
        const hit = swing(DOWN);
        expect(hit.y).toBeCloseTo(ORIGIN.y + 90, 5);
    });

    it('rotates the sensor body to match the swing', () => {
        const diagonal = swing(-Math.PI / 4); // up-right
        expect(diagonal.angle).toBeCloseTo(-Math.PI / 4, 5);
    });

    it('keeps the box geometry and reach', () => {
        const hit = swing(UP, { range: 200, hitWidth: 80 });
        expect(hit.width).toBe(80);
        expect(hit.height).toBe(40);
        // Far edge still lands exactly at `range`.
        expect(ORIGIN.y - hit.y + hit.width / 2).toBeCloseTo(200, 5);
    });

    it('aims the procedural arc along the same direction', () => {
        const hit = swing(UP);
        // The arc graphic is positioned at the origin and rotated by the aim.
        expect(hit.graphicsRotations.some((radians) => Math.abs(radians - UP) < 1e-9)).toBe(true);
    });
});