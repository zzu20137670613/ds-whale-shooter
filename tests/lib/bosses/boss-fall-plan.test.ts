/**
 * tests/lib/bosses/boss-fall-plan.test.ts
 * --------------------------------------------------------------------------
 * How the three-second 灭世 -> 神 pause is staged.
 *
 * The owner, after playing: `打boss的时候灭世阶段打完，切换到神阶段的时候那3秒倒地动作没了，直接
 * 无缝切换了`.
 *
 * The pause was keyed on the death track existing. It does not exist: `claude.yaml` animates
 * `idle / walk / run / dodge` and nothing else, so neither branch of the old code ran, the sprite
 * was never told to lie down, and the next form was already standing one frame later. The pause
 * has to be a property of the phase change, not of which clips a sheet happens to carry - and
 * when there is no clip at all, it still has to LOOK like a beat rather than a jump-cut.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { bossFallAlpha, bossFallPlan, bossFallTilt } from '@/lib/bosses/phases';

const ROOT = process.cwd();
const controller = () => readFileSync(join(ROOT, 'src', 'game', 'monsters', 'monster.ts'), 'utf8');

describe('bossFallPlan', () => {
    it('uses the death track when the sheet has one', () => {
        expect(bossFallPlan({ hasDeath: true, hasTurn: true })).toBe('death');
        expect(bossFallPlan({ hasDeath: true, hasTurn: false })).toBe('death');
    });

    it('falls back to the turn track when that is all there is', () => {
        expect(bossFallPlan({ hasDeath: false, hasTurn: true })).toBe('turn');
    });

    it('still stages a beat when the sheet has neither - the case we actually ship', () => {
        // 灭世·Claude's sheet is idle/walk/run/dodge. "No clip" must not mean "no pause".
        expect(bossFallPlan({ hasDeath: false, hasTurn: false })).toBe('fade');
    });
});

describe('the controller', () => {
    it('asks the plan instead of assuming a death clip exists', () => {
        expect(controller()).toContain('bossFallPlan(');
    });

    it('freezes the track for the whole window, whatever the plan is', () => {
        // Set before the clip branches, so the `fade` path also holds the frame.
        const source = controller();
        const assign = source.indexOf('m.fallUntil = m.invulnerableUntil');
        const plan = source.indexOf('bossFallPlan(');
        expect(assign).toBeGreaterThan(-1);
        expect(plan).toBeGreaterThan(-1);
        expect(assign).toBeLessThan(plan);
    });

    it('fades her out for the beat when there is no art to fall with', () => {
        expect(controller()).toContain("plan === 'fade'");
    });
});

describe('bossFallAlpha', () => {
    it('starts visible, is gone in the middle, and comes back', () => {
        expect(bossFallAlpha(0)).toBe(1);
        expect(bossFallAlpha(0.4)).toBe(0);
        expect(bossFallAlpha(0.5)).toBe(0);
        expect(bossFallAlpha(1)).toBe(1);
    });

    it('never leaves the 0..1 range, whatever it is handed', () => {
        for (const p of [-1, 0, 0.2, 0.45, 0.8, 1, 2]) {
            const a = bossFallAlpha(p);
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(1);
        }
    });
});

describe('bossFallTilt', () => {
    it('stands upright at the start and lies flat at the end', () => {
        expect(bossFallTilt(0)).toBe(0);
        expect(bossFallTilt(1)).toBe(80);
    });

    it('is most of the way down by the halfway mark', () => {
        // She falls fast, then lies there for the rest of the beat.
        expect(bossFallTilt(0.55)).toBe(80);
        expect(bossFallTilt(0.3)).toBeGreaterThan(30);
    });

    it('stays inside the 0..80 range', () => {
        for (const p of [-1, 0, 0.4, 0.75, 1, 3]) {
            expect(bossFallTilt(p)).toBeGreaterThanOrEqual(0);
            expect(bossFallTilt(p)).toBeLessThanOrEqual(80);
        }
    });
});
