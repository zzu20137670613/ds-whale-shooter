/**
 * src/game/bosses/arena-arrow.ts
 * --------------------------------------------------------------------------
 * The arrow that says "the fight continues in the next block".
 *
 * Drawn, not painted: three chevrons and a soft glow, no texture needed, so the boss walk has
 * no art dependency and the level stays one file lighter. It pulses so it reads as a door and
 * not as scenery, and it is drawn above the floor but below the HUD.
 */

export interface ArenaArrowHandle {
    destroy(): void;
}

/** Draw a chevron pair at a world position. Direction comes from the block walk. */
export function createArenaArrow(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: 'up' | 'right' | 'down' | 'left' = 'right',
): ArenaArrowHandle {
    const glow = scene.add.circle(x, y, 46, 0xfbbf24, 0.16).setDepth(y - 2);
    const chevrons: Phaser.GameObjects.Graphics[] = [];
    const baseAngle =
        direction === 'right'
            ? 0
            : direction === 'down'
              ? Math.PI / 2
              : direction === 'left'
                ? Math.PI
                : -Math.PI / 2;

    for (let i = 0; i < 3; i++) {
        const g = scene.add.graphics({ x, y }).setDepth(y);
        const reach = 26 + i * 16;
        // A ">" built from two strokes.
        g.lineStyle(7, 0xfbbf24, 1);
        g.beginPath();
        g.moveTo(-reach * 0.45, -reach * 0.55);
        g.lineTo(reach * 0.35, 0);
        g.lineTo(-reach * 0.45, reach * 0.55);
        g.strokePath();
        g.rotation = baseAngle;
        g.setAlpha(1 - i * 0.22);
        chevrons.push(g);
    }

    // A slow breath, so the door catches the eye without shouting over the fight.
    const tw = scene.tweens.add({
        targets: [glow, ...chevrons],
        alpha: { from: 0.55, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
    });

    return {
        destroy() {
            tw.remove();
            glow.destroy();
            for (const c of chevrons) c.destroy();
        },
    };
}
export interface PointerArrowHandle {
    /** Put the arrow at a world position (usually a ring around the player). */
    setPosition(x: number, y: number): void;
    /** Point it along a world angle, radians, 0 = +x. */
    setAngle(radians: number): void;
    destroy(): void;
}

/**
 * The same chevrons, but free to point anywhere and to follow the player.
 *
 * The arena arrow answers "which way is the next block", a question with four answers. This one
 * answers "where is the last monster", which can be any angle, so the geometry is a container
 * the caller moves instead of three absolute positions.
 */
export function createPointerArrow(scene: Phaser.Scene): PointerArrowHandle {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const glow = scene.add.circle(0, 0, 30, 0xfbbf24, 0.18);
    parts.push(glow);
    for (let i = 0; i < 2; i++) {
        const g = scene.add.graphics({ x: 0, y: 0 });
        const reach = 22 + i * 14;
        g.lineStyle(6, 0xfbbf24, 1);
        g.beginPath();
        g.moveTo(-reach * 0.45, -reach * 0.55);
        g.lineTo(reach * 0.35, 0);
        g.lineTo(-reach * 0.45, reach * 0.55);
        g.strokePath();
        g.setAlpha(1 - i * 0.3);
        parts.push(g);
    }
    const tw = scene.tweens.add({
        targets: parts,
        alpha: { from: 0.6, to: 1 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
    });

    return {
        setPosition(x, y) {
            glow.setPosition(x, y);
            for (const part of parts) {
                if (part !== glow) (part as Phaser.GameObjects.Graphics).setPosition(x, y);
            }
        },
        setAngle(radians) {
            for (const part of parts) {
                if (part !== glow) (part as Phaser.GameObjects.Graphics).setRotation(radians);
            }
        },
        destroy() {
            tw.remove();
            for (const part of parts) part.destroy();
        },
    };
}
