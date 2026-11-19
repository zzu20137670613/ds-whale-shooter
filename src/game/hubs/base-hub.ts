/**
 * src/game/hubs/base-hub.ts
 * --------------------------------------------------------------------------
 * Base class for a HUD group drawn on the Phaser canvas.
 *
 * Scale.FIT shrinks the game world to fit the viewport, but a HUD authored in
 * screen pixels should look the same at any window size. The trick: place the
 * container in world coords and apply setScale(1/fitScale) — children can then
 * be drawn at literal screen-pixel sizes and still come out the intended size.
 *
 * Only the *sizes* are screen-space. The container's position is ordinary
 * world space, because the one HUD built on this today is the floating name
 * and HP/SP bar above an entity, anchored to that entity's body and required
 * to move with it. The screen-fixed HUDs — bars, hotbar, ammo, reload — are
 * React overlays fed through the store, so the camera cannot move them at all.
 *
 * Subclasses inherit the container + destroy plumbing and only need to focus
 * on their specific elements.
 */

/** FIT scale ratio the engine applies between gameSize and displaySize. */
export function hudFitScale(scene: Phaser.Scene): number {
    return Math.min(
        scene.scale.displaySize.width / scene.scale.gameSize.width,
        scene.scale.displaySize.height / scene.scale.gameSize.height,
    );
}

/**
 * Create a HUD container at `x, y` in world coordinates, scaled so that
 * children drawn in screen pixels keep their intended size.
 *
 * Deliberately NOT scroll-locked: the callers position this from world
 * coordinates (see `StatusHud.update`, which writes the entity's body position
 * into it every frame). Pinning it to the camera makes the camera's scroll
 * drag the container away from whatever it is attached to.
 */
function makeHudContainer(
    scene: Phaser.Scene,
    x: number,
    y: number,
    depth: number,
): Phaser.GameObjects.Container {
    const invScale = 1 / hudFitScale(scene);
    const container = scene.add.container(x * invScale, y * invScale);
    container.setScale(invScale);
    container.setDepth(depth);
    return container;
}

export class BaseHud {
    protected readonly root: Phaser.GameObjects.Container;
    protected readonly scene: Phaser.Scene;

    constructor(scene: Phaser.Scene, x: number, y: number, depth = 800) {
        this.scene = scene;
        this.root = makeHudContainer(scene, x, y, depth);
    }

    destroy(): void {
        this.root.destroy();
    }

    /** Toggle visibility of the HUD and all its children. */
    setVisible(visible: boolean): void {
        this.root.setVisible(visible);
    }
}
