import { describe, expect, it } from 'vitest';

import { BaseHud } from '@/game/hubs/base-hub';

/**
 * The slice of Phaser that BaseHud touches. Phaser is a global type in this
 * project (the sources use `Phaser.Scene` without importing it), so the fake
 * scene is cast at the boundary and everything else stays plain data.
 */
interface FakeContainer {
    x: number;
    y: number;
    scale: number;
    depth: number;
    scrollFactorX: number;
    scrollFactorY: number;
    visible: boolean;
    destroyed: boolean;
    setScale(value: number): FakeContainer;
    setDepth(value: number): FakeContainer;
    setScrollFactor(x: number, y?: number): FakeContainer;
    setVisible(value: boolean): FakeContainer;
    destroy(): void;
}

function fakeScene(displayScale = 1): { scene: Phaser.Scene; containers: FakeContainer[] } {
    const containers: FakeContainer[] = [];
    const scene = {
        scale: {
            displaySize: { width: 2752 * displayScale, height: 1536 * displayScale },
            gameSize: { width: 2752, height: 1536 },
        },
        add: {
            container(x: number, y: number): FakeContainer {
                const container: FakeContainer = {
                    x,
                    y,
                    scale: 1,
                    depth: 0,
                    scrollFactorX: 1,
                    scrollFactorY: 1,
                    visible: true,
                    destroyed: false,
                    setScale(value) {
                        container.scale = value;
                        return container;
                    },
                    setDepth(value) {
                        container.depth = value;
                        return container;
                    },
                    setScrollFactor(sx, sy = sx) {
                        container.scrollFactorX = sx;
                        container.scrollFactorY = sy;
                        return container;
                    },
                    setVisible(value) {
                        container.visible = value;
                        return container;
                    },
                    destroy() {
                        container.destroyed = true;
                    },
                };
                containers.push(container);
                return container;
            },
        },
    };
    return { scene: scene as unknown as Phaser.Scene, containers };
}

describe('BaseHud', () => {
    it('stays in world space so an entity-anchored HUD follows its body', () => {
        // Regression guard. This container is positioned from *body* world
        // coordinates — StatusHud.update writes the entity's position into it
        // every frame — so scroll-locking it makes the camera's scroll drag
        // the nameplate off its entity: hundreds of pixels away as soon as the
        // camera starts following. The screen-fixed HUDs (bars, hotbar, ammo,
        // reload) are React overlays fed through the store, and DOM cannot be
        // scrolled by the camera, so they need no lock either.
        const { scene, containers } = fakeScene();
        new BaseHud(scene, 100, 50);
        expect(containers[0].scrollFactorX).toBe(1);
        expect(containers[0].scrollFactorY).toBe(1);
    });

    it('scales children authored in screen pixels to the fit ratio', () => {
        // Viewport is half the canvas, so a child drawn 100px wide lands at
        // 200 game pixels and is scaled up 2x — 100 screen pixels, as drawn.
        const { scene, containers } = fakeScene(0.5);
        new BaseHud(scene, 100, 50);
        expect(containers[0].x).toBe(200);
        expect(containers[0].y).toBe(100);
        expect(containers[0].scale).toBe(2);
    });

    it('puts the HUD above the world', () => {
        const { scene, containers } = fakeScene();
        new BaseHud(scene, 0, 0);
        expect(containers[0].depth).toBe(800);
    });

    it('takes a custom depth', () => {
        const { scene, containers } = fakeScene();
        new BaseHud(scene, 0, 0, 1200);
        expect(containers[0].depth).toBe(1200);
    });

    it('toggles visibility of the whole HUD', () => {
        const { scene, containers } = fakeScene();
        const hud = new BaseHud(scene, 0, 0);
        hud.setVisible(false);
        expect(containers[0].visible).toBe(false);
    });

    it('destroys its container', () => {
        const { scene, containers } = fakeScene();
        new BaseHud(scene, 0, 0).destroy();
        expect(containers[0].destroyed).toBe(true);
    });
});