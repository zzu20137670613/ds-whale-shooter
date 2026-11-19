/**
 * tests/game/levels/exit-arrow.test.ts
 * --------------------------------------------------------------------------
 * The way-out arrow only exists after the map is clear.
 *
 * The owner: `全部打掉后复用boss战的箭头逻辑，指向王座前往boss战`. Two rules, and both are the
 * kind that go wrong silently: an arrow that appears before the waves are done makes the waves
 * pointless, and one that never appears strands the player on a finished map.
 */

import { describe, expect, it } from 'vitest';

import { ExitArrow } from '@/game/levels/exit-arrow';
import { ARROW_RADIUS_PX } from '@/lib/bosses/arena';

const AT = { x: 8148, y: 1690 };

function harness(clear: { value: boolean }) {
    const drawn: { x: number; y: number; direction: string; destroyed: boolean }[] = [];
    let entered = 0;
    const arrow = new ExitArrow({
        scene: {} as never,
        at: AT,
        direction: 'up',
        isClear: () => clear.value,
        onEnter: () => (entered += 1),
        createArrow: (x, y, direction) => {
            const record = { x, y, direction, destroyed: false };
            drawn.push(record);
            return { destroy: () => (record.destroyed = true) };
        },
    });
    return { arrow, drawn, entered: () => entered };
}

describe('before the map is clear', () => {
    it('draws nothing', () => {
        const clear = { value: false };
        const h = harness(clear);
        h.arrow.update({ x: 0, y: 0 });
        expect(h.drawn).toHaveLength(0);
        expect(h.arrow.visible).toBe(false);
    });
});

describe('after it is clear', () => {
    it('draws the arrow once, pointing where the level said', () => {
        const clear = { value: true };
        const h = harness(clear);
        h.arrow.update({ x: 0, y: 0 });
        h.arrow.update({ x: 0, y: 0 });
        expect(h.drawn).toHaveLength(1);
        expect(h.drawn[0]).toMatchObject({ x: AT.x, y: AT.y, direction: 'up' });
    });

    it('does not fire while the player is far away', () => {
        const clear = { value: true };
        const h = harness(clear);
        h.arrow.update({ x: AT.x + ARROW_RADIUS_PX + 10, y: AT.y });
        expect(h.entered()).toBe(0);
    });

    it('fires once when the player walks in, and not again', () => {
        const clear = { value: true };
        const h = harness(clear);
        h.arrow.update({ x: AT.x, y: AT.y });
        h.arrow.update({ x: AT.x, y: AT.y });
        expect(h.entered()).toBe(1);
    });
});

describe('teardown', () => {
    it('destroys the drawn arrow', () => {
        const clear = { value: true };
        const h = harness(clear);
        h.arrow.update({ x: 0, y: 0 });
        h.arrow.destroy();
        expect(h.drawn[0].destroyed).toBe(true);
        expect(h.arrow.visible).toBe(false);
    });
});