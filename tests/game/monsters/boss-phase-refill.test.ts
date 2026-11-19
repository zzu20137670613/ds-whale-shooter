/**
 * tests/game/monsters/boss-phase-refill.test.ts
 * --------------------------------------------------------------------------
 * Wiring: the boss announces a cleared phase, the scene pays the reward.
 *
 * The rule lives in `@/lib/bosses/phase-reward` and is tested there. What can still rot here
 * is the plumbing - the event never being emitted, or the scene listening but never refilling
 * the guns in her hands (the store is a mirror; `refillAmmo()` is what tells the live weapon
 * controller to fill them, so a raw `set({ slots })` would look right in the HUD and change
 * nothing in play).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MONSTER = readFileSync(join(ROOT, 'src', 'game', 'monsters', 'monster.ts'), 'utf8');
const SCENE = readFileSync(join(ROOT, 'src', 'game', 'scenes', 'scene.ts'), 'utf8');

describe('the boss announces a cleared phase', () => {
    it('emits boss:phase-cleared from advancePhase', () => {
        const start = MONSTER.indexOf('private advancePhase');
        expect(start).toBeGreaterThan(-1);
        const body = MONSTER.slice(start, start + 2500);
        expect(body).toContain('BOSS_PHASE_CLEAR_EVENT');
        expect(body).toContain('clearedIndex');
        expect(body).toContain('phaseCount');
    });

    it('emits it before the fatal branch, so the last bar pays out too', () => {
        const start = MONSTER.indexOf('private advancePhase');
        const body = MONSTER.slice(start, start + 2500);
        // The fatal branch now also asks whether this map only fights one phase.
        const fatal = body.indexOf('if (!upcoming || bossPhaseIsFinal');
        expect(fatal).toBeGreaterThan(-1);
        // Announced above the branch: the final bar empties, the boss dies, and the reward
        // must already have been paid rather than skipped by the early return.
        const emitAt = body.indexOf('BOSS_PHASE_CLEAR_EVENT');
        expect(emitAt).toBeGreaterThan(-1);
        expect(emitAt).toBeLessThan(fatal);
        expect(body.slice(fatal, fatal + 200)).toContain('kill(m)');
    });
});

describe('the scene pays it', () => {
    it('subscribes to the event', () => {
        expect(SCENE).toContain('BOSS_PHASE_CLEAR_EVENT');
        expect(SCENE).toContain('phaseClearReward');
    });

    it('refills through the store action, which also tells the live guns', () => {
        const at = SCENE.indexOf('onBossPhaseCleared');
        const body = SCENE.slice(at, at + 1200);
        expect(body).toContain('refillAmmo()');
    });

    it('heals only when the reward says so', () => {
        const at = SCENE.indexOf('onBossPhaseCleared');
        const body = SCENE.slice(at, at + 1200);
        expect(body).toContain('reward.vitals');
        expect(body).toContain('heal(');
    });

    it('cleans the listener up so a restart does not double-pay', () => {
        const at = SCENE.indexOf('onBossPhaseCleared');
        const body = SCENE.slice(at, at + 1600);
        expect(body).toContain('removeListener');
    });
});