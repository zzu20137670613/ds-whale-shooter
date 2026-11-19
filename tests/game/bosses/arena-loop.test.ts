/**
 * tests/game/bosses/arena-loop.test.ts
 * --------------------------------------------------------------------------
 * Walking the four blocks, without a scene.
 *
 * The loop takes injected movers and an injected clock, so the owner's rules can be checked as
 * rules: `灭世` opens nothing, `神` opens the way to the star sea, two seconds later she is in
 * the middle of it, `半神` opens the way to the alley, and so on.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { BossArenaLoop } from '@/game/bosses/arena-loop';
import { arenaBlocks, arrivalPoint, blockCentre } from '@/lib/bosses/arena';
import { BOSS_PHASE_CLEAR_EVENT } from '@/lib/bosses/phase-reward';
import { EventBus } from '@/lib/events/bus';

const SIZE = { width: 11008, height: 6144 };
const BLOCKS = arenaBlocks(SIZE);

interface Harness {
    loop: BossArenaLoop;
    clock: { now: number };
    player: { x: number; y: number };
    moved: { player: { x: number; y: number }[]; boss: { x: number; y: number }[] };
    arrows: { x: number; y: number; destroyed: boolean }[];
    phase: (index: number) => void;
}

function harness(): Harness {
    const clock = { now: 1000 };
    const player = { x: 2752, y: 1536 };
    const moved = { player: [] as { x: number; y: number }[], boss: [] as { x: number; y: number }[] };
    const arrows: { x: number; y: number; destroyed: boolean }[] = [];

    const loop = new BossArenaLoop({
        imageSize: SIZE,
        phaseCount: 5,
        movePlayer: (x, y) => {
            player.x = x;
            player.y = y;
            moved.player.push({ x, y });
        },
        moveBoss: (x, y) => moved.boss.push({ x, y }),
        createArrow: (x, y) => {
            const arrow = { x, y, destroyed: false };
            arrows.push(arrow);
            return { destroy: () => (arrow.destroyed = true) };
        },
        now: () => clock.now,
    });

    return {
        loop,
        clock,
        player,
        moved,
        arrows,
        phase: (index: number) => EventBus.emit(BOSS_PHASE_CLEAR_EVENT, { clearedIndex: index }),
    };
}

beforeEach(() => {
    // Nothing to reset: each harness builds its own loop and tears it down.
});

describe('the first arrow', () => {
    it('does not appear when 灭世 falls', () => {
        const h = harness();
        h.phase(0);
        expect(h.loop.arrowVisible).toBe(false);
        expect(h.arrows).toHaveLength(0);
    });

    it('appears when 神 falls', () => {
        const h = harness();
        h.phase(0);
        h.phase(1);
        expect(h.loop.arrowVisible).toBe(true);
        expect(h.arrows).toHaveLength(1);
        h.loop.destroy();
    });
});

describe('walking through it', () => {
    it('does nothing while the player is far away', () => {
        const h = harness();
        h.phase(1);
        h.loop.update({ x: 0, y: 0 });
        expect(h.moved.player).toHaveLength(0);
        expect(h.loop.currentBlock).toBe(0);
        h.loop.destroy();
    });

    it('moves the player into the next block and takes the arrow away', () => {
        const h = harness();
        h.phase(1);
        const at = h.arrows[0];
        h.loop.update({ x: at.x, y: at.y });
        expect(h.moved.player).toEqual([arrivalPoint(BLOCKS[1])]);
        expect(h.loop.currentBlock).toBe(1);
        expect(h.loop.arrowVisible).toBe(false);
        expect(at.destroyed).toBe(true);
        h.loop.destroy();
    });

    it('waits two seconds before the boss appears in the middle of the block', () => {
        const h = harness();
        h.phase(1);
        const at = h.arrows[0];
        h.loop.update({ x: at.x, y: at.y });

        // Not yet.
        h.clock.now += 1999;
        h.loop.update({ x: 0, y: 0 });
        expect(h.moved.boss).toHaveLength(0);
        expect(h.loop.waitingForBoss).toBe(true);

        // Two seconds on.
        h.clock.now += 1;
        h.loop.update({ x: 0, y: 0 });
        expect(h.moved.boss).toEqual([blockCentre(BLOCKS[1])]);
        expect(h.loop.waitingForBoss).toBe(false);
        h.loop.destroy();
    });
});

describe('the rest of the walk', () => {
    it('opens the alley after 半神, and the church after 半神半人', () => {
        const h = harness();
        h.phase(1);
        h.loop.update({ x: h.arrows[0].x, y: h.arrows[0].y });

        h.phase(2);
        expect(h.arrows).toHaveLength(2);
        h.loop.update({ x: h.arrows[1].x, y: h.arrows[1].y });
        expect(h.loop.currentBlock).toBe(2);

        h.phase(3);
        expect(h.arrows).toHaveLength(3);
        h.loop.update({ x: h.arrows[2].x, y: h.arrows[2].y });
        expect(h.loop.currentBlock).toBe(3);

        h.loop.destroy();
    });

    it('opens no arrow after 克劳德 - that is the ending', () => {
        const h = harness();
        h.phase(4);
        expect(h.loop.arrowVisible).toBe(false);
        expect(h.arrows).toHaveLength(0);
        h.loop.destroy();
    });
});

describe('cleanup', () => {
    it('stops listening once destroyed', () => {
        const h = harness();
        h.phase(1);
        expect(h.arrows).toHaveLength(1);
        h.loop.destroy();
        expect(h.arrows[0].destroyed).toBe(true);
        // A phase event after teardown must not draw anything.
        h.phase(2);
        expect(h.arrows).toHaveLength(1);
    });
});