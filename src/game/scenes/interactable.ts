/**
 * src/game/scenes/interactable.ts
 * --------------------------------------------------------------------------
 * Click targets painted into the art: regions of the world you can click on
 * the way you would click a button.
 *
 * The developer cabin is the first level to use them — the two screens on the
 * desk — and the whole gag depends on them being *exactly* where the screens
 * are drawn, so both rectangles are authored in the level YAML next to the
 * numbers the owner marked on the painting.
 *
 * No Phaser imports: the scene converts a click into world coordinates and
 * hands it here, which keeps the hit test a table of assertions.
 */

export interface ClickZone {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Interactable {
    id: string;
    /** What to do on a hit. The scene maps this to a store action. */
    action: string;
    /** Any of these regions counts as hitting this interactable. */
    zones: readonly ClickZone[];
    /**
     * How it fires. `click` is the original (the cabin's screens); `walk` fires the moment the
     * player's body stands inside a zone, with no button at all.
     *
     * 主人：`走进黄圈就自动获得（不用按键）` - the rice bowl is a `walk` zone; before this it
     * was click-only, so walking to the steel basin did nothing (`走到铁盆那里没显示饭盆彩蛋`).
     */
    /** `enter` 由场景在读图时直接放，不进这里的点击/走进判定。 */
    trigger?: 'click' | 'walk' | 'enter';
}

const inside = (zone: ClickZone, x: number, y: number): boolean =>
    x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height;

export class InteractableController {
    private readonly items: readonly Interactable[];

    constructor(items: readonly Interactable[] | undefined) {
        this.items = items ?? [];
    }

    /**
     * The interactable under a world point, or null. Later entries win, which is
     * how an author overrides a big backdrop zone with a small precise one.
     */
    at(x: number, y: number): Interactable | null {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.zones.some((zone) => inside(zone, x, y))) return item;
        }
        return null;
    }

    /** True when the point was consumed — the scene uses it to swallow a shot. */
    handleClick(x: number, y: number): Interactable | null {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.trigger === 'walk') continue;
            if (item.zones.some((zone) => inside(zone, x, y))) return item;
        }
        return null;
    }

    /** The walk-in zone under the player's feet, or null. */
    walkInto(x: number, y: number): Interactable | null {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (item.trigger !== 'walk') continue;
            if (item.zones.some((zone) => inside(zone, x, y))) return item;
        }
        return null;
    }
}
