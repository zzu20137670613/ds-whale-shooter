/**
 * tests/lib/bosses/fall-pause.test.ts
 * --------------------------------------------------------------------------
 * 灭世·Claude goes down for three seconds before 神·Claude stands up.
 *
 * The owner: `之前我们约定的灭世·Claude倒下的2秒动画再衔接神·Claude，实机测试时发现这两秒动画
 * 没有，直接无缝衔接了…把2秒改成3秒，让倒下的动作放慢`.
 *
 * Two separate faults, both pinned here:
 *   - the pause was 2 s and is now 3 s, and the fall IS the pause (not an extra wait);
 *   - the fall never played, because the per-frame track picker chose `turn` on the very
 *     next frame and cut the death clip off after one frame.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOSS_FALL_MS } from '@/lib/bosses/phases';
import { BOSS_PHASE_TRANSITION_MS } from '@/lib/constants';
import { monsterAnimTrack } from '@/game/monsters/logic';

const ROOT = process.cwd();
const controller = () => readFileSync(join(ROOT, 'src', 'game', 'monsters', 'monster.ts'), 'utf8');

describe('the length of the pause', () => {
    it('is three seconds', () => {
        expect(BOSS_FALL_MS).toBe(3000);
    });

    it('is longer than the ordinary phase beat, so the fall reads as its own beat', () => {
        expect(BOSS_FALL_MS).toBeGreaterThan(BOSS_PHASE_TRANSITION_MS);
    });
});

describe('the controller', () => {
    it('gives the fall the whole pause instead of adding the two together', () => {
        // 2000 + 3000 would mean five seconds of waiting for a body that is already gone.
        expect(controller()).toContain(
            '(falling ? BOSS_FALL_MS : BOSS_PHASE_TRANSITION_MS)',
        );
        expect(controller()).not.toContain('BOSS_PHASE_TRANSITION_MS + (falling');
    });

    it('keeps the death clip on screen for that window', () => {
        expect(controller()).toContain('m.fallUntil = m.invulnerableUntil');
    });

    it('stretches the clip to fill it', () => {
        expect(controller()).toContain('clip.duration / BOSS_FALL_MS');
    });

    it('draws the fall from the death track, not the idle one', () => {
        expect(controller()).toContain("animTrack === 'fall' ? 'death' : animTrack");
    });
});

describe('what the player sees', () => {
    it('is a body on the floor for the whole window, then the next form', () => {
        const startedAt = 10_000;
        const lying = { now: startedAt + 2900, fallUntil: startedAt + BOSS_FALL_MS };
        const up = { now: startedAt + BOSS_FALL_MS, fallUntil: startedAt + BOSS_FALL_MS };
        const anim = (now: number, fallUntil: number) =>
            monsterAnimTrack({
                isHit: false,
                hasTurn: true,
                turnUntil: 0,
                now,
                chasing: true,
                fallUntil,
            });

        expect(anim(lying.now, lying.fallUntil)).toBe('fall');
        expect(anim(up.now, up.fallUntil)).toBe('move');
    });
});